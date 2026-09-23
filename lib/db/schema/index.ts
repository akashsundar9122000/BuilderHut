export * from "./_shared";
export * from "./tenancy";
export * from "./identity";
export * from "./storefront";
export * from "./catalog";
export * from "./customers";
export * from "./commerce";
export * from "./operations_commerce";
export * from "./analytics";
export * from "./operations";

/*
 * Every table must appear in exactly one of the three sets below. This is not
 * bookkeeping — it is what the tenancy layer consults at query time, and an
 * unclassified table throws rather than quietly returning unscoped rows.
 *
 * tests/security/tenancy.conformance.test.ts enforces the rest: that each
 * TENANT_SCOPED table really has a NOT NULL tenant_id, a foreign key to tenants,
 * and at least one index whose FIRST column is tenant_id. Getting that index
 * wrong doesn't break anything visibly; it just makes every query in the product
 * slower as data grows, which nobody notices until it's expensive.
 */

/** Owned by one merchant. tenant_id NOT NULL, FK to tenants, leading-tenant index. */
export const TENANT_SCOPED = new Set<string>([
  // storefront
  "websites",
  "site_versions",
  // catalog
  "products",
  "product_images",
  "categories",
  "product_categories",
  "inventory_movements",
  // customers — a separate identity realm, owned by one store
  "customers",
  "customer_sessions",
  "customer_addresses",
  "wishlist_items",
  // commerce
  "carts",
  "cart_items",
  "orders",
  "order_items",
  "order_addresses",
  "payments",
  "refunds",
  "idempotency_keys",
  "discounts",
  "discount_redemptions",
  // operations
  "shipping_zones",
  "shipping_methods",
  "tax_rules",
  "store_settings",
  // analytics
  "analytics_events",
  "analytics_daily_rollups",
]);

/**
 * Nullable tenant_id: NULL means the shared platform catalogue (industries,
 * stock templates, default policy text) and a value means a merchant's own copy.
 * Deliberately kept tiny — the conformance test caps it, because "maybe shared"
 * is the classification bugs hide in.
 */
export const GLOBAL_OR_SCOPED = new Set<string>([]);

/** Not owned by any tenant. Reading these outside a tenant context is correct. */
export const PLATFORM = new Set<string>([
  "tenants",
  "audit_logs",
  // Authentication, owned by Better Auth. Not tenant-owned: a user exists
  // before any store does, and may belong to several.
  "users",
  "sessions",
  "accounts",
  "verifications",
  // Read to DISCOVER a user's tenants, which necessarily happens before a
  // tenant context exists. Authorized by userId instead — see identity.ts.
  "tenant_members",
]);

export function classify(table: string): "tenant" | "global" | "platform" {
  if (TENANT_SCOPED.has(table)) return "tenant";
  if (GLOBAL_OR_SCOPED.has(table)) return "global";
  if (PLATFORM.has(table)) return "platform";
  throw new Error(
    `Table "${table}" is not classified. Add it to TENANT_SCOPED, GLOBAL_OR_SCOPED or PLATFORM in lib/db/schema/index.ts — and to the RLS policies if it is tenant-owned.`,
  );
}
