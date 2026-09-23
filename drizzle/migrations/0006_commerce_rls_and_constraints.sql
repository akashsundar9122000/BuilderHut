-- Row-level security and constraints for the commerce tables.
--
-- Same shape as migration 0001: RLS on, FORCE so even a table owner is subject
-- to it, and one policy comparing tenant_id to the transaction-local setting
-- that withTenant() establishes. NULLIF for the reason migration 0002 gives —
-- an unset setting is an empty string on a reused pooled connection, and
-- ''::uuid raises rather than matching nothing.
--
-- This matters more here than anywhere else in the schema. These tables hold
-- other people's customers, addresses, orders and payment records.

ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_images" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "product_images_tenant_isolation" ON "product_images"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "categories_tenant_isolation" ON "categories"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "product_categories_tenant_isolation" ON "product_categories"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "inventory_movements_tenant_isolation" ON "inventory_movements"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "customers_tenant_isolation" ON "customers"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "customer_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "customer_sessions_tenant_isolation" ON "customer_sessions"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_addresses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "customer_addresses_tenant_isolation" ON "customer_addresses"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "wishlist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "wishlist_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "wishlist_items_tenant_isolation" ON "wishlist_items"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "carts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "carts_tenant_isolation" ON "carts"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cart_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "cart_items_tenant_isolation" ON "cart_items"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "orders_tenant_isolation" ON "orders"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_items_tenant_isolation" ON "order_items"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "order_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_addresses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "order_addresses_tenant_isolation" ON "order_addresses"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "payments_tenant_isolation" ON "payments"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "refunds_tenant_isolation" ON "refunds"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "idempotency_keys" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "idempotency_keys_tenant_isolation" ON "idempotency_keys"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "discounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "discounts_tenant_isolation" ON "discounts"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "discount_redemptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "discount_redemptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "discount_redemptions_tenant_isolation" ON "discount_redemptions"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "shipping_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shipping_zones" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "shipping_zones_tenant_isolation" ON "shipping_zones"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "shipping_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shipping_methods" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "shipping_methods_tenant_isolation" ON "shipping_methods"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "tax_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tax_rules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tax_rules_tenant_isolation" ON "tax_rules"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "store_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "store_settings_tenant_isolation" ON "store_settings"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

-- Constraints drizzle-kit cannot express.

-- Customer email uniqueness is per store and case-insensitive. Without the
-- lower(), Akash@ and akash@ are two customers of the same shop, and the one
-- who typed it differently at checkout loses their order history.
DROP INDEX IF EXISTS "customers_tenant_email_key";--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_email_lower_key"
  ON "customers" ("tenant_id", lower("email"));--> statement-breakpoint

-- Money is never negative, and a total that does not equal its parts is a bug
-- that would otherwise only surface in someone's accounts.
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts_non_negative" CHECK (
  "subtotal_minor" >= 0 AND "discount_minor" >= 0 AND "shipping_minor" >= 0
  AND "tax_minor" >= 0 AND "total_minor" >= 0 AND "refunded_minor" >= 0
);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refund_within_total"
  CHECK ("refunded_minor" <= "total_minor");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_currency_iso"
  CHECK ("currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_number_positive"
  CHECK ("number" > 0);--> statement-breakpoint

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive"
  CHECK ("quantity" > 0);--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_amounts_non_negative" CHECK (
  "unit_price_minor" >= 0 AND "line_discount_minor" >= 0
  AND "line_tax_minor" >= 0 AND "line_total_minor" >= 0
);--> statement-breakpoint

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_positive"
  CHECK ("quantity" > 0);--> statement-breakpoint

ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive"
  CHECK ("amount_minor" > 0);--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive"
  CHECK ("amount_minor" > 0);--> statement-breakpoint

-- A percentage over 100% or under 0% is not a discount.
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_percent_in_range" CHECK (
  "kind" <> 'percent' OR ("value" > 0 AND "value" <= 10000)
);--> statement-breakpoint
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_redemptions_within_max" CHECK (
  "max_redemptions" IS NULL OR "redemptions" <= "max_redemptions"
);--> statement-breakpoint

-- A tax rate between 0% and 100%. 1800 basis points is 18%.
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_rate_in_range"
  CHECK ("rate_basis_points" >= 0 AND "rate_basis_points" <= 10000);--> statement-breakpoint

ALTER TABLE "shipping_methods" ADD CONSTRAINT "shipping_methods_price_non_negative"
  CHECK ("price_minor" >= 0);--> statement-breakpoint

-- Stock can be negative only if the merchant is not tracking it; with tracking
-- on, overselling is the failure this prevents.
ALTER TABLE "products" ADD CONSTRAINT "products_stock_when_tracked"
  CHECK (NOT "track_stock" OR "stock" >= 0);
