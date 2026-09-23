-- Let routing read an ACTIVE domain without a tenant context.
--
-- A visitor arriving at a merchant's custom domain is anonymous: there is no
-- session, so there is no tenant context, so the tenant-isolation policy alone
-- matches nothing and the hostname resolves to a 404 on a shop that plainly
-- exists. That is the same trap that cost an hour on slug resolution; the
-- difference is that slugs live on `tenants`, which has no policy, and domains
-- do.
--
-- Policies are OR'd, so this ADDS a public read path without weakening
-- anything: it exposes only rows that are already live and already public —
-- an active custom domain is, by definition, published in DNS. Writes and reads
-- of pending, misconfigured or disabled domains stay tenant-scoped, so one
-- merchant still cannot enumerate another's verification tokens or see a domain
-- they have not finished connecting.

CREATE POLICY "domains_public_routing" ON "domains"
  FOR SELECT
  USING ("status" = 'active');
