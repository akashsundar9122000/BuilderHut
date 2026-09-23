import { index, pgEnum, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { nullableTimestamp, primaryId, timestamps } from "./_shared";

export const tenantStatus = pgEnum("tenant_status", ["active", "suspended", "closed"]);

/*
 * A tenant is one merchant business. It is NOT one user: a user may own several
 * businesses, and a business may have several staff. Modelling those as the same
 * thing is cheap on day one and expensive to unpick later, so they are separate
 * from the start even though only the owner role is exposed initially.
 *
 * This table is PLATFORM-classified — it has no tenant_id of its own, and it has
 * to be readable before a tenant context exists (that is how the context gets
 * established in the first place).
 */
export const tenants = pgTable(
  "tenants",
  {
    id: primaryId(),
    name: text("name").notNull(),
    /** Chosen at onboarding, used for the free platform address. Globally unique. */
    slug: varchar("slug", { length: 40 }).notNull(),
    industry: text("industry").notNull(),
    status: tenantStatus("status").notNull().default("active"),
    /** Store-level, never inferred from the visitor's browser locale. */
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    country: varchar("country", { length: 2 }).notNull().default("IN"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    suspendedAt: nullableTimestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("tenants_slug_key").on(t.slug),
    index("tenants_status_created_idx").on(t.status, t.createdAt),
  ],
);
