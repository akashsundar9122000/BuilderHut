import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createdAt, nullableTimestamp, primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";

export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);

/*
 * Minimal on purpose — variants, images, categories, inventory movements and SEO
 * arrive in Phase 1. What matters here is the shape:
 *
 *   price_minor is a bigint of MINOR units (paise), never a float. 149900 = ₹1,499.00.
 *   currency travels with every money-bearing row, so a historical price stays
 *   readable after a store changes currency.
 *
 * Identifiers are unique within a tenant, not globally: two merchants must both
 * be allowed a product called "classic-tee".
 */
export const products = pgTable(
  "products",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: text("description"),
    status: productStatus("status").notNull().default("draft"),
    priceMinor: bigint("price_minor", { mode: "bigint" }).notNull(),
    compareAtMinor: bigint("compare_at_minor", { mode: "bigint" }),
    currency: varchar("currency", { length: 3 }).notNull(),
    sku: varchar("sku", { length: 80 }),
    /*
     * Stock, and whether to enforce it. A maker of one-off pieces tracks stock;
     * someone selling a made-to-order service does not, and forcing them to
     * would mean their shop closes itself the moment the number hits zero.
     */
    trackStock: boolean("track_stock").notNull().default(false),
    stock: integer("stock").notNull().default(0),
    lowStockAt: integer("low_stock_at").notNull().default(3),
    /** Physical goods need shipping; a download does not. */
    requiresShipping: boolean("requires_shipping").notNull().default(true),
    weightGrams: integer("weight_grams"),
    /** India: HSN/SAC for GST. Blank elsewhere — see the tax rules. */
    hsnCode: varchar("hsn_code", { length: 12 }),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    deletedAt: nullableTimestamp("deleted_at"),
    ...timestamps(),
  },
  (t) => [
    index("products_tenant_status_created_idx").on(t.tenantId, t.status, t.createdAt),
    uniqueIndex("products_tenant_slug_key").on(t.tenantId, t.slug),
  ],
);

/*
 * Product images.
 *
 * Separate from products because a product has several, they are ordered, and
 * each carries alt text — which is a real accessibility obligation on a public
 * storefront, not a nicety. `mediaKey` is the storage key; the URL is derived,
 * so moving from KV to R2 does not rewrite every row.
 */
export const productImages = pgTable(
  "product_images",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaKey: text("media_key").notNull(),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("product_images_tenant_product_idx").on(t.tenantId, t.productId, t.position)],
);

/** Collections. Flat for now — nested categories are a Phase 8 problem. */
export const categories = pgTable(
  "categories",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("categories_tenant_slug_key").on(t.tenantId, t.slug),
    index("categories_tenant_position_idx").on(t.tenantId, t.position),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => [
    index("product_categories_tenant_category_idx").on(t.tenantId, t.categoryId),
    uniqueIndex("product_categories_unique").on(t.productId, t.categoryId),
  ],
);

export const movementReason = pgEnum("movement_reason", [
  "sale",
  "cancellation",
  "refund",
  "restock",
  "manual",
  "import",
]);

/*
 * Every change to stock, with its reason.
 *
 * The balance lives on products.stock; this is the ledger that explains it.
 * Blueprint section 35.1 asks for both, and the reason is what makes "we have
 * fourteen and I cannot think why" answerable. Append-only: a correction is a
 * new movement, never an edit.
 */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Signed: negative for a sale, positive for a restock. */
    delta: integer("delta").notNull(),
    /** The balance after this movement, so history reads without replaying it. */
    balanceAfter: integer("balance_after").notNull(),
    reason: movementReason("reason").notNull(),
    orderId: uuid("order_id"),
    note: text("note"),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("inventory_movements_tenant_product_idx").on(t.tenantId, t.productId, t.createdAt),
    index("inventory_movements_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);
