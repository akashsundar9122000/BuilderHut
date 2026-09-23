-- Row-level security, hand-written and kept in its own reviewable file.
--
-- drizzle-kit cannot emit policies, and burying the tenant boundary inside a
-- generated table diff would make it invisible in review. Every tenant-owned
-- table gets the same shape: RLS enabled, FORCE so even a table owner is
-- subject to it, and one policy comparing tenant_id to the transaction-local
-- app.tenant_id that withTenant() sets.
--
-- current_setting(..., true) returns NULL rather than erroring when the setting
-- is absent, so a query with no tenant context matches no rows instead of
-- blowing up. That is the intended failure mode, and it is why an empty result
-- should always be suspected of being a missing context before missing data.

ALTER TABLE "websites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "websites" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "websites_tenant_isolation" ON "websites"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "site_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "site_versions_tenant_isolation" ON "site_versions"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "products_tenant_isolation" ON "products"
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);--> statement-breakpoint

-- Constraints drizzle-kit cannot express.

-- Money is in minor units and cannot be negative. A negative price is not a
-- discount; it is a bug that would pay the customer.
ALTER TABLE "products" ADD CONSTRAINT "products_price_non_negative"
  CHECK ("price_minor" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_compare_at_non_negative"
  CHECK ("compare_at_minor" IS NULL OR "compare_at_minor" >= 0);--> statement-breakpoint

-- ISO 4217 is three uppercase letters. Storing 'inr' and 'INR' as different
-- currencies is the kind of thing that only surfaces during a refund.
ALTER TABLE "products" ADD CONSTRAINT "products_currency_iso"
  CHECK ("currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_currency_iso"
  CHECK ("currency" ~ '^[A-Z]{3}$');--> statement-breakpoint

-- Store slugs become public URLs: lowercase, no leading/trailing hyphen.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_format"
  CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$');--> statement-breakpoint

ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_number_positive"
  CHECK ("version_number" > 0);
