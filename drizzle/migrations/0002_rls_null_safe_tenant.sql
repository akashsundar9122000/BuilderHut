-- Make the tenant predicate NULL-safe.
--
-- 0001 compared against current_setting('app.tenant_id', true)::uuid on the
-- assumption that an unset setting yields NULL. It does — but only until
-- set_config(..., is_local => true) has run once on that connection. After the
-- transaction ends the setting still EXISTS on the session, holding an empty
-- string, and ''::uuid raises 22P02 instead of returning NULL.
--
-- Because the pool reuses connections, that means the first request to touch an
-- RLS table outside a tenant context AFTER any tenant request would fail with
-- "invalid input syntax for type uuid" rather than degrading to zero rows. The
-- security property held; the failure mode was an error instead of an empty
-- result, and it depended on which connection the request happened to get.
--
-- NULLIF restores the intended behaviour: no context means no rows.

DROP POLICY IF EXISTS "websites_tenant_isolation" ON "websites";--> statement-breakpoint
CREATE POLICY "websites_tenant_isolation" ON "websites"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "site_versions_tenant_isolation" ON "site_versions";--> statement-breakpoint
CREATE POLICY "site_versions_tenant_isolation" ON "site_versions"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

DROP POLICY IF EXISTS "products_tenant_isolation" ON "products";--> statement-breakpoint
CREATE POLICY "products_tenant_isolation" ON "products"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
