import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { namedTimestamp, nullableTimestamp, primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";

/*
 * Storefront customers — a completely separate identity realm from merchants.
 *
 * A customer of one store is not a customer of another. The same person, with
 * the same address, may hold accounts at a dozen stores on this platform and
 * they must not be linked: knowing which other shops someone buys from is not
 * information a merchant is entitled to.
 *
 * That is also why this is not Better Auth. Better Auth assumes email is
 * globally unique; here it is unique PER TENANT, which is the opposite
 * assumption. Rather than fight a library's model, this realm gets its own
 * tables and its own small session implementation.
 */
export const customers = pgTable(
  "customers",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /*
     * Nullable, because a store may sign its customers in by mobile number
     * alone. A row always has one of email or phone — the accompanying
     * migration's CHECK constraint is what guarantees it.
     */
    email: text("email"),
    name: text("name"),
    /**
     * E.164 and nothing else ("+919876543210"). lib/customers/phone.ts is the
     * only thing that writes this column, and a CHECK constraint backs it up:
     * "+91 98765 43210" and "09876543210" are the same person, and storing both
     * shapes means two accounts and a support ticket.
     */
    phone: varchar("phone", { length: 32 }),
    /** Argon2id. Null for a guest who checked out without making an account. */
    passwordHash: text("password_hash"),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneVerified: boolean("phone_verified").notNull().default(false),
    /** Null until they sign in for the first time. A guest row never has one. */
    lastLoginAt: nullableTimestamp("last_login_at"),
    acceptsMarketing: boolean("accepts_marketing").notNull().default(false),
    notes: text("notes"),
    deletedAt: nullableTimestamp("deleted_at"),
    ...timestamps(),
  },
  (t) => [
    // Per tenant, not globally — see the note above. The case-insensitive
    // version is in the accompanying migration.
    uniqueIndex("customers_tenant_email_key").on(t.tenantId, t.email),
    /*
     * Partial, because most rows have no phone at all: every guest who checked
     * out without one is NULL here, and a plain unique index would be fine with
     * that but a reader would not know why. Created by hand in the migration,
     * after the existing numbers have been normalised — see the note there.
     */
    uniqueIndex("customers_tenant_phone_key")
      .on(t.tenantId, t.phone)
      .where(sql`"phone" IS NOT NULL`),
    index("customers_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The token itself is never stored. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("customer_sessions_token_key").on(t.tokenHash),
    index("customer_sessions_tenant_customer_idx").on(t.tenantId, t.customerId),
    index("customer_sessions_expires_idx").on(t.expiresAt),
  ],
);

/*
 * One-time codes, for signing in, proving an address or claiming a guest row.
 *
 * Deliberately NOT Better Auth's `verifications` table. That one is a platform
 * table owned by the library's adapter: it has no tenant_id, so it can carry no
 * RLS policy, and a code that is not isolated to one store is the exact failure
 * this realm exists to prevent. It also has nowhere to keep an attempt count, a
 * purpose or a channel.
 */
export const customerVerificationPurpose = pgEnum("customer_verification_purpose", [
  "signup",
  "login",
  "claim",
  "verify",
  "password_reset",
]);

export const customerVerificationChannel = pgEnum("customer_verification_channel", [
  "email",
  "sms",
]);

export const customerVerifications = pgTable(
  "customer_verifications",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /*
     * The normalised email or E.164 number the code was sent to — not a
     * customerId, because a code is usually issued before any row exists.
     */
    identifier: text("identifier").notNull(),
    channel: customerVerificationChannel("channel").notNull(),
    purpose: customerVerificationPurpose("purpose").notNull(),
    /**
     * HMAC-SHA256 of the code, keyed by the deployment secret. Not a bare hash:
     * six digits is a million-entry dictionary, which is no secret at all
     * against someone holding a database dump. The code itself is never stored.
     */
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    /** Three wrong guesses burn the code. */
    attempts: integer("attempts").notNull().default(0),
    /**
     * Set when the code is accepted AND when it is burned, so it works exactly
     * once either way. Rows are consumed rather than deleted: they are also the
     * ledger the send caps count off.
     */
    consumedAt: nullableTimestamp("consumed_at"),
    /** Present only when the code concerns a row that already exists. */
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    ipAddress: text("ip_address"),
    ...timestamps(),
  },
  (t) => [
    index("customer_verifications_tenant_lookup_idx").on(
      t.tenantId,
      t.identifier,
      t.purpose,
      t.createdAt,
    ),
    // How many texts this store has sent today — the money cap reads this.
    index("customer_verifications_tenant_channel_idx").on(t.tenantId, t.channel, t.createdAt),
    index("customer_verifications_expires_idx").on(t.expiresAt),
  ],
);

/*
 * Rate limit counters, in the database rather than in memory.
 *
 * This deploys serverless and fans out, so an in-memory counter is per instance:
 * with N warm instances the effective limit is N times the intended one, and it
 * resets on every cold start — which is exactly when a scripted burst arrives,
 * because a burst is what causes the scale-out. It also cannot express "this
 * store may send 100 texts a day", because money is spent globally.
 *
 * One row per bucket rather than one per attempt: bounded, and a burst
 * serialises on the row lock instead of racing.
 */
export const customerRateLimits = pgTable(
  "customer_rate_limits",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** "<limit>:<subject>" — an identifier, or "store" for a per-store cap. */
    bucket: text("bucket").notNull(),
    windowStartedAt: namedTimestamp("window_started_at"),
    count: integer("count").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("customer_rate_limits_tenant_bucket_key").on(t.tenantId, t.bucket),
    index("customer_rate_limits_window_idx").on(t.windowStartedAt),
  ],
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: varchar("phone", { length: 32 }),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    region: text("region"),
    postalCode: varchar("postal_code", { length: 16 }),
    country: varchar("country", { length: 2 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps(),
  },
  (t) => [index("customer_addresses_tenant_customer_idx").on(t.tenantId, t.customerId)],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: uuid("product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("wishlist_items_unique").on(t.customerId, t.productId),
    index("wishlist_items_tenant_customer_idx").on(t.tenantId, t.customerId),
  ],
);
