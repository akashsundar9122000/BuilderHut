import { sql } from "drizzle-orm";
import { bigint, date, index, integer, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";

/*
 * Analytics, kept away from the transactional tables.
 *
 * Blueprint section 35.1 is explicit: high-volume storefront events must not be
 * allowed to grow the tables that hold orders and payments indefinitely. So raw
 * events live here with a short retention, and a nightly job folds them into
 * daily rollups that the dashboards actually read.
 *
 * Two consequences worth stating. Dashboard queries never scan raw events —
 * they read one row per day per store. And purging raw events after their
 * retention window costs nothing, because the numbers that matter have already
 * been counted.
 */

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** page_view, product_view, add_to_cart, checkout_start, order_paid, … */
    name: varchar("name", { length: 40 }).notNull(),
    /*
     * A visitor, not a person. A random id in a first-party cookie, used only
     * to tell one session's page views apart from another's. No cross-store
     * identity, no profile, nothing joined back to a customer record.
     */
    visitorId: varchar("visitor_id", { length: 40 }),
    sessionId: varchar("session_id", { length: 40 }),
    path: text("path"),
    productId: uuid("product_id"),
    referrerHost: text("referrer_host"),
    utmSource: varchar("utm_source", { length: 60 }),
    utmMedium: varchar("utm_medium", { length: 60 }),
    utmCampaign: varchar("utm_campaign", { length: 60 }),
    /** "mobile" | "tablet" | "desktop". Coarse on purpose. */
    device: varchar("device", { length: 10 }),
    /** For order events. Minor units, with the order's currency. */
    valueMinor: bigint("value_minor", { mode: "bigint" }),
    currency: varchar("currency", { length: 3 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("analytics_events_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("analytics_events_tenant_name_created_idx").on(t.tenantId, t.name, t.createdAt),
  ],
);

/**
 * One row per store per day. This is what every dashboard reads.
 *
 * Denormalised on purpose: these are counts of things that have already
 * happened and cannot change retroactively, which is the only case where a
 * stored aggregate is safe.
 */
export const analyticsDailyRollups = pgTable(
  "analytics_daily_rollups",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    visitors: integer("visitors").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    pageViews: integer("page_views").notNull().default(0),
    productViews: integer("product_views").notNull().default(0),
    addToCarts: integer("add_to_carts").notNull().default(0),
    checkoutStarts: integer("checkout_starts").notNull().default(0),
    orders: integer("orders").notNull().default(0),
    revenueMinor: bigint("revenue_minor", { mode: "bigint" }).notNull().default(sql`0`),
    currency: varchar("currency", { length: 3 }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("analytics_rollups_tenant_day_key").on(t.tenantId, t.day),
    index("analytics_rollups_tenant_day_idx").on(t.tenantId, t.day),
  ],
);
