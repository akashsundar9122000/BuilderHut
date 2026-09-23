-- Row-level security for the media library.
--
-- A shop's uploads are its product photography, which is both commercially
-- valuable and, at a content-addressed key, guessable by anyone who has the
-- file. Isolation here is what stops one merchant enumerating another's.
--
-- The platform-read policy matches the 28 tables in 0013: an operator answering
-- "why is this shop over its storage limit" needs to see the rows, and only
-- when they have deliberately opened a withPlatformAdmin transaction.

ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "media_assets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "media_assets_tenant_isolation" ON "media_assets"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

CREATE POLICY "media_assets_platform_read" ON "media_assets"
  FOR SELECT
  USING (current_setting('app.platform_admin', true) = 'on');--> statement-breakpoint

-- A file has a size. Zero bytes is not a picture, and a negative one is a bug
-- that would make a storage meter read backwards.
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_size_positive" CHECK ("size_bytes" > 0);
