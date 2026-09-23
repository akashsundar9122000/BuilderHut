import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";

/*
 * Shipping and tax, as configuration rather than code.
 *
 * Blueprint section 13 is emphatic: do not hard-code one jurisdiction's tax
 * rules as universal truth. A merchant in Chennai and one in Manchester both
 * need this to work, and neither should inherit the other's assumptions. So a
 * tax rule is a named rate with a scope, and GST is one configuration of it
 * rather than a special case in the code.
 */

export const shippingZones = pgTable(
  "shipping_zones",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** ISO country codes this zone covers. Empty means everywhere else. */
    countries: jsonb("countries").notNull().default([]),
    /** Postcode prefixes for local delivery — "600" covers Chennai. */
    postalPrefixes: jsonb("postal_prefixes").notNull().default([]),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("shipping_zones_tenant_position_idx").on(t.tenantId, t.position)],
);

export const shippingRate = pgEnum("shipping_rate_kind", ["flat", "free", "free_over"]);

export const shippingMethods = pgTable(
  "shipping_methods",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => shippingZones.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** "2–4 working days", "Collect from the kitchen, Sat 9–2". */
    description: text("description"),
    kind: shippingRate("kind").notNull().default("flat"),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull().default(sql`0`),
    /** For free_over: the subtotal at which the charge disappears. */
    thresholdMinor: bigint("threshold_minor", { mode: "bigint" }),
    /** Collection rather than delivery: no address needed, no charge implied. */
    isPickup: boolean("is_pickup").notNull().default(false),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("shipping_methods_tenant_zone_idx").on(t.tenantId, t.zoneId, t.position)],
);

export const taxRules = pgTable(
  "tax_rules",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** What appears on the invoice: "GST 18%", "VAT", "Sales tax". */
    name: text("name").notNull(),
    /** Basis points — 1800 is 18%. Integers, because 0.18 is not 18%. */
    rateBasisPoints: integer("rate_basis_points").notNull(),
    /*
     * Inclusive means the price already contains the tax and it is broken out
     * on the invoice; exclusive means it is added at checkout. India quotes
     * inclusive, the United States quotes exclusive, and getting it backwards
     * changes what the customer pays.
     */
    inclusive: boolean("inclusive").notNull().default(true),
    /** Empty means every country. */
    countries: jsonb("countries").notNull().default([]),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("tax_rules_tenant_active_idx").on(t.tenantId, t.active, t.position)],
);

/*
 * Per-store commerce settings.
 *
 * One row per tenant. Checkout behaviour is a merchant decision — blueprint
 * section 10 — and a bakery taking pre-orders wants different answers from a
 * seller of digital downloads.
 */
export const checkoutMode = pgEnum("checkout_mode", ["guest", "optional_account", "account_required"]);

export const storeSettings = pgTable(
  "store_settings",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    checkoutMode: checkoutMode("checkout_mode").notNull().default("guest"),
    requirePhone: boolean("require_phone").notNull().default(true),
    allowOrderNotes: boolean("allow_order_notes").notNull().default(true),
    showMarketingConsent: boolean("show_marketing_consent").notNull().default(true),
    requireTermsAcceptance: boolean("require_terms_acceptance").notNull().default(false),
    /** "dummy" until a real gateway is connected. */
    paymentProvider: varchar("payment_provider", { length: 32 }).notNull().default("dummy"),
    /** India: the merchant's GST registration number, shown on invoices. */
    gstin: varchar("gstin", { length: 20 }),
    ...timestamps(),
  },
  // Exactly one settings row per store — two would mean the checkout behaves
  // differently depending on which one a query happened to read first.
  (t) => [uniqueIndex("store_settings_tenant_key").on(t.tenantId)],
);
