-- Constraints drizzle-kit cannot express, for the identity tables.

-- Email uniqueness must be case-insensitive.
--
-- Without this, Akash@example.com and akash@example.com are two accounts. The
-- user who signs up with one and later types the other gets "no account found"
-- and, worse, can create a duplicate — then owns two stores and cannot work out
-- why their products vanished. A plain unique index cannot express this, so the
-- generated one is replaced with a functional index on lower(email).
DROP INDEX IF EXISTS "users_email_key";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));--> statement-breakpoint

-- An address that is at least plausibly an address. Real validation happens in
-- the application; this stops obvious rubbish reaching the table at all.
ALTER TABLE "users" ADD CONSTRAINT "users_email_shape"
  CHECK (position('@' in "email") > 1 AND length("email") >= 6);--> statement-breakpoint

-- Exactly one owner per tenant, enforced by the database rather than by
-- remembering to check. A store with no owner is unadministrable; a store with
-- two has an ambiguous billing and deletion authority.
CREATE UNIQUE INDEX "tenant_members_single_owner_key"
  ON "tenant_members" ("tenant_id") WHERE "role" = 'owner';--> statement-breakpoint

-- Verification rows are throwaway. This lets the cleanup job delete by expiry
-- without scanning, and it is the index the expiry check itself uses.
CREATE INDEX IF NOT EXISTS "verifications_identifier_expires_idx"
  ON "verifications" ("identifier", "expires_at" DESC);
