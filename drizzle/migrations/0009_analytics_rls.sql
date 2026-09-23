-- Row-level security for the analytics tables.
--
-- Same shape as every other tenant-owned table. These hold a store's traffic,
-- which is commercially sensitive: knowing a competitor's conversion rate is
-- exactly the kind of thing tenant isolation exists to prevent.
--
-- Retention is enforced by the nightly job rather than by the database, because
-- "delete rows older than N days" is a policy a platform admin should be able
-- to change without a migration.

ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "analytics_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "analytics_events_tenant_isolation" ON "analytics_events"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "analytics_daily_rollups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "analytics_daily_rollups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "analytics_daily_rollups_tenant_isolation" ON "analytics_daily_rollups"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

-- Counts cannot be negative, and revenue cannot be either.
ALTER TABLE "analytics_daily_rollups" ADD CONSTRAINT "analytics_rollups_non_negative" CHECK (
  "visitors" >= 0 AND "sessions" >= 0 AND "page_views" >= 0 AND "product_views" >= 0
  AND "add_to_carts" >= 0 AND "checkout_starts" >= 0 AND "orders" >= 0
  AND "revenue_minor" >= 0
);
