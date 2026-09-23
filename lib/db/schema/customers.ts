import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { nullableTimestamp, primaryId, timestamps } from "./_shared";
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
    email: text("email").notNull(),
    name: text("name"),
    phone: varchar("phone", { length: 32 }),
    /** Argon2id. Null for a guest who checked out without making an account. */
    passwordHash: text("password_hash"),
    emailVerified: boolean("email_verified").notNull().default(false),
    acceptsMarketing: boolean("accepts_marketing").notNull().default(false),
    notes: text("notes"),
    deletedAt: nullableTimestamp("deleted_at"),
    ...timestamps(),
  },
  (t) => [
    // Per tenant, not globally — see the note above. The case-insensitive
    // version is in the accompanying migration.
    uniqueIndex("customers_tenant_email_key").on(t.tenantId, t.email),
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
