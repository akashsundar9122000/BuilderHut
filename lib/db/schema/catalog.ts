import { bigint, index, pgEnum, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { primaryId, nullableTimestamp, timestamps } from "./_shared";
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
    deletedAt: nullableTimestamp("deleted_at"),
    ...timestamps(),
  },
  (t) => [
    index("products_tenant_status_created_idx").on(t.tenantId, t.status, t.createdAt),
    uniqueIndex("products_tenant_slug_key").on(t.tenantId, t.slug),
  ],
);
