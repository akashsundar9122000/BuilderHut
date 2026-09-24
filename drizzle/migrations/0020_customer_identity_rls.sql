-- Row-level security and constraints for the customer identity realm.
--
-- Same shape as migration 0006: RLS on, FORCE so even a table owner is subject
-- to it, and one policy comparing tenant_id to the transaction-local setting
-- withTenant() establishes. NULLIF because an unset setting is an empty string
-- on a reused pooled connection, and ''::uuid raises rather than matching
-- nothing.
--
-- Note what is NOT here: a platform_read policy. Every other tenant table has
-- one so an operator can answer a support question, but live one-time codes and
-- somebody's login-attempt history are not things a support question needs.

ALTER TABLE "customer_verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_verifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "customer_verifications_tenant_isolation" ON "customer_verifications"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

ALTER TABLE "customer_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_rate_limits" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "customer_rate_limits_tenant_isolation" ON "customer_rate_limits"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint

-- A customer, and an order, is always reachable by something. Both columns are
-- now nullable so a store can sign people in by mobile number alone; neither
-- may be a row with no way to reach the person.
ALTER TABLE "customers" ADD CONSTRAINT "customers_identifier_present"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_present"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);--> statement-breakpoint

ALTER TABLE "customer_verifications" ADD CONSTRAINT "customer_verifications_attempts_sane"
  CHECK ("attempts" >= 0 AND "attempts" <= 10);--> statement-breakpoint
ALTER TABLE "customer_rate_limits" ADD CONSTRAINT "customer_rate_limits_count_non_negative"
  CHECK ("count" >= 0);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Existing phone numbers, normalised before the unique index goes on.
--
-- Until now a customer's phone came straight off the checkout form and was
-- stored as typed, so "+91 98765 43210", "09876543210" and "9876543210" are all
-- in this column and all the same person. A UNIQUE index added to that data
-- fails the deploy on the first shop with two such rows, so the cleanup has to
-- come first, in this order, in this file.
-- ---------------------------------------------------------------------------

-- 0. RLS is lifted for the owner while this runs, and put back afterwards.
--
--    "customers" carries FORCE ROW LEVEL SECURITY, which subjects even the table
--    owner to the policy — and the policy compares tenant_id to app.tenant_id,
--    which no migration sets. A role with BYPASSRLS ignores all of that, and the
--    role this currently runs as has it, so the UPDATEs below would work today.
--
--    They are not left depending on that. Whether the migration role keeps a
--    superuser-ish attribute is not something this repository controls, and the
--    failure if it ever changes is the worst shape there is: every UPDATE matches
--    zero rows, reports success, and the unique index at step 6 fails the deploy
--    on data nobody cleaned — or worse, succeeds on an empty table and lets the
--    duplicates through later.
--
--    NO FORCE exempts the owner only; RLS stays on for the application role
--    throughout. The whole migration is one transaction, so a failure anywhere
--    below restores FORCE along with everything else.
ALTER TABLE "customers" NO FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 1. Strip everything a person types between digits. Deterministic, and it
--    cannot change which number a row refers to.
UPDATE "customers"
   SET "phone" = regexp_replace("phone", '[^0-9+]', '', 'g')
 WHERE "phone" IS NOT NULL;--> statement-breakpoint

-- 2. Give a bare national number its country code, from the STORE's country —
--    the same default lib/customers/phone.ts applies. Only the countries
--    onboarding offers, plus Canada; anything else falls to step 3.
UPDATE "customers" c
   SET "phone" = d.dial || regexp_replace(c."phone", '^0+', '')
  FROM "tenants" t,
       (VALUES ('IN','+91'),('GB','+44'),('US','+1'),('CA','+1'),
               ('AE','+971'),('SG','+65'),('AU','+61')) AS d(country, dial)
 WHERE c."tenant_id" = t."id"
   AND t."country" = d.country
   AND c."phone" IS NOT NULL
   AND c."phone" NOT LIKE '+%';--> statement-breakpoint

-- 3. Anything still not E.164, and every remaining duplicate, loses the phone
--    rather than the row.
--
--    NULLing is recoverable: the number is still on the order it came from. The
--    alternative — merging two customer rows — moves somebody's order history
--    onto an identifier they may not own, which is the one thing this realm
--    exists to prevent. The most recently active row keeps the number.
WITH ranked AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "tenant_id", "phone"
           ORDER BY "updated_at" DESC, "created_at" DESC
         ) AS rn
    FROM "customers"
   WHERE "phone" IS NOT NULL
)
UPDATE "customers"
   SET "phone" = NULL
 WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1)
    OR ("phone" IS NOT NULL AND "phone" !~ '^\+[1-9][0-9]{7,14}$');--> statement-breakpoint

-- 4. A row emptied by step 3 that also has no email would now violate the
--    constraint added above. There is no address to invent, so the row is the
--    guest ledger entry for an order that is still intact; give it a placeholder
--    nobody can sign in with rather than deleting somebody's order history.
UPDATE "customers"
   SET "email" = 'unknown+' || "id" || '@invalid.local'
 WHERE "email" IS NULL AND "phone" IS NULL;--> statement-breakpoint

-- 5. FORCE goes back on before anything else. Leaving it off would quietly
--    exempt the owner from tenant isolation on the table that holds every shop's
--    customer list — the single worst row in this schema to get wrong.
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 6. Only now is the index safe. Not CONCURRENTLY: drizzle runs a migration
--    inside a transaction, and CREATE INDEX CONCURRENTLY cannot be.
CREATE UNIQUE INDEX "customers_tenant_phone_key"
  ON "customers" ("tenant_id", "phone") WHERE "phone" IS NOT NULL;--> statement-breakpoint

-- The stored shape, enforced. lib/customers/phone.ts is the only thing that
-- writes this column; this is what makes that statement true rather than hopeful.
ALTER TABLE "customers" ADD CONSTRAINT "customers_phone_e164"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$');
