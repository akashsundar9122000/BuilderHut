-- Row-level security for domains, plus the guarantees routing depends on.

ALTER TABLE "domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "domains" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "domains_tenant_isolation" ON "domains"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

-- Exactly one primary domain per store.
--
-- Two would mean alternates redirecting to whichever row a query happened to
-- return first, so a shop's canonical address would change between requests —
-- which search engines would read as two competing sites.
CREATE UNIQUE INDEX "domains_single_primary_key"
  ON "domains" ("tenant_id") WHERE "is_primary";--> statement-breakpoint

-- A hostname is lowercase, dot-separated labels, no scheme, no path, no port.
-- Routing matches on this column, so anything else in it is unreachable data.
ALTER TABLE "domains" ADD CONSTRAINT "domains_hostname_shape" CHECK (
  "normalized_hostname" ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  AND length("normalized_hostname") <= 253
);
