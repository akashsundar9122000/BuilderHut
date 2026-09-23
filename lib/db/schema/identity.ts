import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { nullableTimestamp, primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";

/*
 * Identity is split deliberately.
 *
 * Better Auth owns authentication — users, sessions, accounts, verifications.
 * It does NOT own tenancy. The organization plugin would have given memberships
 * and invitations for free, but it brings its own assumptions about what an
 * organization is, and bending the tenant model to fit a plugin is the wrong
 * trade when tenant isolation is the thing that must not be got wrong. So
 * tenant_members below is ours, and the RLS/conformance machinery stays
 * authoritative over it.
 *
 * Table names are pluralised: Better Auth defaults to `user`, and USER is a
 * reserved word in Postgres. Drizzle quotes identifiers so it would work, but
 * every hand-written migration and psql session would need the quotes too.
 *
 * There is a second, entirely separate identity realm for storefront customers
 * (Phase 3). A customer of one store is not a customer of another, and the same
 * address may exist in both realms — Better Auth assumes globally unique emails,
 * so customers get their own tables rather than being forced in here.
 */

export const users = pgTable(
  "users",
  {
    // Better Auth generates the id; generateId is configured to return uuidv7
    // so these stay uuid and can be referenced by tenant-scoped tables.
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** Operator of the platform itself, not of any store. Grants /admin. */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    // Addresses are matched case-insensitively; a functional unique index does
    // the enforcing, added in the accompanying hand-written migration.
    uniqueIndex("users_email_key").on(t.email),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /**
     * Which store this session is currently acting for. A user with several
     * businesses switches between them; the tenant is never taken from the
     * request body.
     */
    activeTenantId: uuid("active_tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("sessions_token_key").on(t.token),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    /** "credential" for password, otherwise the OAuth provider id. */
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: nullableTimestamp("access_token_expires_at"),
    refreshTokenExpiresAt: nullableTimestamp("refresh_token_expires_at"),
    scope: text("scope"),
    /** Argon2id hash. Never a plaintext password, never a reversible encoding. */
    password: text("password"),
    ...timestamps(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_key").on(t.providerId, t.accountId),
  ],
);

/**
 * Short-lived tokens: email verification codes, password reset tokens.
 * `value` holds a hash, never the code itself — see lib/auth/merchant.ts.
 */
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ...timestamps(),
  },
  (t) => [
    index("verifications_identifier_idx").on(t.identifier),
    index("verifications_expires_idx").on(t.expiresAt),
  ],
);

export const memberRole = pgEnum("member_role", ["owner", "admin", "manager", "staff"]);

/*
 * Who may act for which store.
 *
 * Classified PLATFORM rather than TENANT_SCOPED, and that is not an oversight:
 * this table is read to DISCOVER which tenant a request belongs to, which
 * necessarily happens before a tenant context exists. Its authorization axis is
 * the user, not the tenant — every query filters by the authenticated userId,
 * so a member can only ever see their own memberships.
 *
 * Only `owner` is exposed in the UI initially, but the roles exist from the
 * start because retrofitting RBAC over a single-role assumption means touching
 * every authorization check.
 */
export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("owner"),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: nullableTimestamp("accepted_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("tenant_members_tenant_user_key").on(t.tenantId, t.userId),
    index("tenant_members_user_idx").on(t.userId),
  ],
);

/*
 * An invitation to help run a shop.
 *
 * PLATFORM for the same reason tenant_members is: the person accepting has no
 * tenant context yet — discovering which shop they have been invited to is
 * the whole point of the row. Its authorization axis is the token, which is
 * random, single-use and short-lived.
 *
 * The email is stored rather than a user id, because the usual case is
 * inviting somebody who has no account yet. Accepting matches on the email of
 * whoever is signed in, so an invitation cannot be redeemed by forwarding the
 * link to someone else.
 */
export const tenantInvitations = pgTable(
  "tenant_invitations",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull().default("staff"),
    /** Random, and the only thing that proves the link came from us. */
    token: text("token").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: nullableTimestamp("accepted_at"),
    revokedAt: nullableTimestamp("revoked_at"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("tenant_invitations_token_key").on(t.token),
    // One live invitation per address per shop: re-inviting replaces rather
    // than accumulating, so a revoked link cannot be resurrected by a second.
    uniqueIndex("tenant_invitations_tenant_email_key").on(t.tenantId, t.email),
    index("tenant_invitations_tenant_idx").on(t.tenantId, t.createdAt),
  ],
);
