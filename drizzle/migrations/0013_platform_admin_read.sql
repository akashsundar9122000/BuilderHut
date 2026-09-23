-- A read-only escape from tenant isolation, for the platform operator.
--
-- The admin console has to answer questions that span every shop: how many
-- merchants are active, what the platform's GMV is, which stores are failing.
-- The application connects as a NOBYPASSRLS role, so a cross-tenant SELECT
-- currently returns zero rows — silently, which is the worst possible shape for
-- a number on a dashboard.
--
-- Three deliberate limits on what this grants:
--
--   FOR SELECT only. A platform admin can look at merchant data; they cannot
--   quietly edit it. Suspending a store writes to `tenants`, which carries no
--   policy and is therefore already an explicit, audited action.
--
--   It is keyed on a transaction-local setting that only withPlatformAdmin()
--   sets, and that helper refuses to run without an actor id and writes an
--   audit row. There is no way to reach it from ordinary feature code.
--
--   SET LOCAL, so it cannot survive onto the pooled connection and leak into
--   the next request that borrows the socket.
--
-- The alternative — looping withTenant() over every store for every figure —
-- is N queries per dashboard and gets slower exactly as the platform succeeds.

CREATE POLICY "websites_platform_read" ON "websites"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "site_versions_platform_read" ON "site_versions"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "products_platform_read" ON "products"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "product_images_platform_read" ON "product_images"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "categories_platform_read" ON "categories"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "product_categories_platform_read" ON "product_categories"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "inventory_movements_platform_read" ON "inventory_movements"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "customers_platform_read" ON "customers"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "customer_sessions_platform_read" ON "customer_sessions"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "customer_addresses_platform_read" ON "customer_addresses"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "wishlist_items_platform_read" ON "wishlist_items"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "carts_platform_read" ON "carts"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "cart_items_platform_read" ON "cart_items"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "orders_platform_read" ON "orders"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "order_items_platform_read" ON "order_items"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "order_addresses_platform_read" ON "order_addresses"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "payments_platform_read" ON "payments"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "refunds_platform_read" ON "refunds"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "idempotency_keys_platform_read" ON "idempotency_keys"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "discounts_platform_read" ON "discounts"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "discount_redemptions_platform_read" ON "discount_redemptions"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "shipping_zones_platform_read" ON "shipping_zones"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "shipping_methods_platform_read" ON "shipping_methods"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "tax_rules_platform_read" ON "tax_rules"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "store_settings_platform_read" ON "store_settings"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "analytics_events_platform_read" ON "analytics_events"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "analytics_daily_rollups_platform_read" ON "analytics_daily_rollups"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

CREATE POLICY "domains_platform_read" ON "domains"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');
