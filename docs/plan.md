# BuilderHut — Implementation Plan

## Context

BuilderHut is a greenfield multi-tenant SaaS: non-technical sellers (crochet makers, invitation
designers, bakers, T-shirt brands, jewellers, digital creators) sign up, answer a few questions,
pick an industry template, customise it in a visual drag-and-drop builder, add products, and
publish a real storefront with cart, checkout and a simulated payment gateway — while the platform
owner watches every store, its traffic and its revenue from a separate admin console.

The 105-section blueprint supplied in the request is the product specification. This plan turns it
into a buildable architecture and a phase sequence, and resolves the contradictions in it.

**Current state:** `/Users/akash/Documents/BuilderHut` is completely empty. The Neon database is
empty (Postgres 18.6, ap-southeast-1, no tables, only `neondb_owner`). The GitHub repo
`akashsundar9122000/BuilderHut` exists with zero refs.

**Two blockers found during exploration, both handled in Phase 0:**

1. `BuilderHut/` is **not** its own git repo — git commands there resolve up to a stray repo at
   `/Users/akash/Documents` whose remote is your **Wedding** repo. A `git add .` there would stage
   your entire Documents folder (PDFs, a 16MB video, every other project). Phase 0 runs
   `git init` *inside* `BuilderHut` before anything else.
2. The Neon password was pasted into this conversation. It goes into a gitignored `.env.local`,
   and **you should rotate it in the Neon console** once the project is running.

---

## Decisions locked

| Area | Decision | Why |
|---|---|---|
| Host | **Vercel** | Your existing, proven target (FolioForge). Next.js functions are native — skips every monorepo bundling trap FITRIX hit. |
| Database | **Neon Postgres** (the provided `neondb`) | Blueprint §35.1 mandates it and explicitly overrides the D1 references in §33/34/61/94/99/102. |
| Repo shape | **One Next.js 16 app**, route groups per surface | Five surfaces in one deployment; no cross-package build orchestration. |
| Storefront rendering | **SSR from page schema via a React component registry** | Same components render the builder canvas *and* the live store — true WYSIWYG, live cart/stock/price, real SEO. |
| Media | **Cloudflare R2** (S3 API, presigned uploads) | 10GB free, zero egress, built for hundreds of product images per merchant. |
| Email | **Nodemailer + SMTP**, console fallback in dev | Same as FolioForge; works offline with no account configured. |
| Merchant auth | **Better Auth** (organization + emailOTP + admin plugins) | Proven on Better Auth 1.7.x + Next 16 + Drizzle; gives orgs/members/roles/invites for §2.3 RBAC free. |
| Tenant isolation | **App-layer `TenantDb` chokepoint + Postgres RLS backstop** | Defense in depth, exactly as FITRIX ships it. |
| AI | **NVIDIA NIM** behind a provider interface | You're supplying the key; NIM is OpenAI-compatible so the client is standard. |
| Market | **India first, multi-currency ready** | INR default, paise as integer minor units, GSTIN/HSN fields present but configurable. |
| Templates | **12+**, one per onboarding industry | With a hard rule (below) that stops them collapsing into one recoloured layout. |
| Testing | **Blueprint §74 in full** + CI | Unit, integration, Playwright E2E, and explicit cross-tenant security tests. |
| Scope | **All 8 phases, sequenced**, check-in at each boundary | No deadline; build it properly. |
| Visual identity | **Warm editorial / craft** | Bone canvas, ink text, clay accent, serif display. Deliberately unlike FITRIX's slate dark. |
| Delivery | **One phase at a time**, each verified on localhost and pushed to `main` | Deploy only after Phase 8. |

### Blueprint deviations, and why

- **D1/KV/Workers/Queues/Analytics Engine → Neon/Vercel equivalents.** Jobs that §95 assigns to
  Cloudflare Queues run as **Vercel Cron + a `jobs` table** with retry and dead-letter columns.
  Events that §16 assigns to Workers Analytics Engine go to a **separate `analytics_events` table
  with short retention**, rolled up nightly into `analytics_daily_rollups` — honouring §35.1's
  "raw events must not grow the transactional tables" rule without a second vendor.
- **Custom domains (§14, §29) are designed and built now but cannot be verified end-to-end until
  you own a domain.** Until then storefronts live at `/s/:slug` in production and
  `<slug>.lvh.me:3000` in dev; the wildcard host becomes a single env var later.

---

---

## Delivery rhythm — every phase, without exception

No phase is "done" because the code compiles. Each one runs this loop before the next begins:

1. **Build** the phase's deliverables.
2. **Test end to end** — unit and integration tests written *with* the feature, plus the Playwright
   journey for that phase, all green.
3. **Run it on localhost** (`pnpm dev`) and actually use it: the real flow, clicked through, in
   **light and dark**, at **desktop and phone width**. Screens get looked at before they're called
   done — not inferred from passing tests.
4. **Fix what looking at it reveals.** This is where the §0.1 bar is actually met.
5. **Commit and push to `main`** with a message describing the phase outcome.
6. **Check in with you**, then start the next phase.

Nothing is deployed to Vercel until all eight phases are complete. `main` stays continuously
working — every push is a state you could run yourself.

---

## Visual identity — warm editorial / craft

Distinct from FITRIX (slate dark, gradient accent) and from FolioForge. BuilderHut's audience makes
things by hand; the product should look like it belongs in that world, not in an admin panel.

```text
LIGHT                          DARK (warm black, never blue-black)
  canvas   #FBF8F3  bone         canvas   #17130F
  surface  #FFFFFF               surface  #211B16
  raised   #F5F0E8               raised   #2B231C
  border   #E7DFD3               border   #352C24
  text     #1C1917  ink          text     #F5EFE7
  muted    #6B625A               muted    #A89C8E
  accent   #C2603F  clay         accent   #E8845C  lifted clay
  accent-2 #1F6F5C  deep green   accent-2 #45A98C
```

- **Type:** a serif display face for editorial headlines (large, tight, confident) paired with a
  clean grotesque for UI and body. The pairing is the identity — most SaaS uses one grotesque for
  everything, and that's exactly what §0.1 forbids.
- **Surface treatment:** paper-like. Fine 1px borders and low, soft shadows rather than big blurry
  drop shadows. Restrained grain on marketing surfaces only, never in the dashboard.
- **Radii:** moderate and consistent (not pill-everything, not sharp). Cards 12px, controls 8px.
- **Dark mode is a re-derivation, not an inversion** — warm near-black page, raised warm-brown
  sheet, accent lifted for contrast. Every token pair passes WCAG AA, enforced by
  `scripts/check-contrast.ts` in the `verify` gate.
- **Storefront themes are independent.** This identity governs marketing, onboarding, dashboard,
  builder chrome and platform admin. Merchant storefronts have their own template themes — a bakery
  must not inherit BuilderHut's palette.
- Hard rule, enforced in review: **no raw hex in any component**, ever. Tokens only.

### The landing page is a Phase 1 deliverable, not an afterthought

Built to §0.1: cinematic hero that immediately shows what the builder produces, animated store
previews, an interactive template carousel, scroll-driven storytelling, a live "watch a store get
built" before/after sequence, real storefront previews rather than flat screenshots, feature
storytelling instead of text walls, pricing interaction, FAQ accordion with real motion, and a
polished footer. Every animation earns its place — orientation, feedback, hierarchy, continuity or
delight — and `prefers-reduced-motion` is respected from the first commit, not retrofitted.

It gets a second dedicated pass in Phase 7 once real merchant stores exist to showcase.

---

## What I need from you (not blocking Phase 0–1)

| Item | Needed by | Notes |
|---|---|---|
| Cloudflare R2 account id, bucket name, access key id + secret | Phase 1 (media library) | Until then uploads fall back to local disk in dev. |
| NVIDIA NIM API key + preferred model id | Phase 7 (AI assistant) | Interface and mock generator built earlier, so nothing is blocked. |
| SMTP host/user/pass | Phase 1 (email verification) | Falls back to printing the code to the dev console, so signup works today. |
| Neon password rotation | Before first deploy | It's in this transcript. |
| A domain | Phase 4 (custom domains) | Everything works on `/s/:slug` without one. |

---

## Repository layout

```text
BuilderHut/
  app/
    (marketing)/                 /  /templates  /templates/[id]  /pricing  /features
    (auth)/                      /signup  /login  /verify  /forgot
    (onboarding)/onboarding/     the §4.4 wizard, step per route segment
    (dashboard)/app/             merchant console — §9 sidebar
      products/  collections/  orders/  customers/  inventory/  discounts/
      content/  analytics/  marketing/  settings/  payments/  shipping/
      taxes/  domains/  team/  notifications/
      sites/[siteId]/builder/    the visual builder (own layout, no dashboard chrome)
    (platform)/admin/            platform owner console — §15 sidebar
    (storefront)/store/[slug]/   public storefront; middleware rewrites hosts here
    api/                         route handlers (§36 domains)
  middleware.ts                  hostname/slug → store resolution
  lib/
    db/        client.ts  tenant.ts  audit.ts  migrate.ts  schema/  _shared.ts
    auth/      merchant.ts (Better Auth)  customer.ts  policy.ts
    schema/    page.ts  theme.ts  contracts/ (zod, one file per API domain)
    render/    registry.tsx  sections/  theme-css.ts  seo.ts
    builder/   store.ts  commands.ts (undo/redo)  patch.ts (AI ops)
    commerce/  money.ts  cart.ts  pricing.ts  discounts.ts  tax.ts  shipping.ts
               orders.ts (state machine)
    payments/  provider.ts  dummy.ts
    media/     r2.ts  upload.ts
    email/     provider.ts  smtp.ts  templates/
    ai/        provider.ts  nvidia.ts  ops.ts
    analytics/ track.ts  rollup.ts
    jobs/      queue.ts  handlers/
  components/
    ui/        design system primitives (§38)
    dashboard/ KPI card, chart card, data table, filter bar, command menu (§18)
    builder/   Canvas, Inspector, LayerTree, AddPanel, DevicePreview
  templates/   one folder per industry template
  styles/      tokens.css   (Tailwind v4 CSS-first, the single source of colour)
  drizzle/     migrations/  meta/
  scripts/     seed/  check-*.mjs  normalise-journal.mjs
  tests/       unit/  integration/  security/
  e2e/         Playwright
  docs/        blueprint.md (the supplied spec, committed)  architecture.md  deployment.md
```

**Reused directly from FITRIX** (`/Users/akash/Documents/Fitrix`): the strict `tsconfig.base.json`
settings, `packages/db/src/schema/_shared.ts` column helpers, the `TenantDb`/`withTenant` design in
`packages/db/src/tenant.ts`, the dual-driver `client.ts`, `sql/roles.sql`, the tenancy conformance
test, `tooling/normalise-journal.mjs`, and the `tokens.css` theming approach in
`apps/web/src/styles/tokens.css`.

**Reused conceptually from FolioForge** (`/Users/akash/Documents/portfolio-builder`): the
`lib/render` "pure renderer, one source of truth for preview and live" thesis; publish re-renders
from validated JSON and never trusts client output; content-hash asset naming; slug reserved/blocked
lists and old-slug 308 redirects (`lib/server/sites.ts`); allowlisted AI patch ops
(`lib/builder/patch.ts`); the `verify` quality-gate script.

---

## Core architecture

### 1. Tenancy (the thing that must not be got wrong)

Three layers, matching FITRIX:

**Layer 1 — `lib/db/tenant.ts`.** The only door to tenant data.

```ts
await withTenant({ tenantId, actorId, role }, async (db) => {
  const rows = await db.select().from(products).where(eq(products.status, 'active'));
});
```

- Opens one transaction, sets `app.tenant_id` / `app.actor_id` / `app.actor_role` with
  `SET LOCAL` (plain `SET` does not survive PgBouncer).
- `select()` returns a **thenable** that injects the tenant predicate at execution time, so joins
  and `.where()` still compose and there is no terminal call a developer can forget.
- `insert` strips any caller-supplied `tenantId` and stamps the context one; `update` refuses to
  change `tenant_id`; `update`/`delete` AND the scope into the WHERE.
- An `AsyncLocalStorage` guard throws if `withTenant` is called inside `withTenant` — nested calls
  deadlock against Neon's `max: 1` pool in production while passing locally at `max: 5`.
- Escape hatches are deliberately ugly: `db.unsafeRaw(justification)` throws on a short
  justification, and CI greps for call sites.
- `col(table, column)` helper for correlated subqueries — Drizzle drops the table qualifier when
  there is no join, and the subquery then silently returns 0.

**Layer 2 — Postgres RLS.** A `builderhut_app` role created `NOBYPASSRLS` with DML-only grants plus
`ALTER DEFAULT PRIVILEGES` so future tables are covered. Policies compare against
`current_setting('app.tenant_id')`, hand-written in reviewable migration files. Two connection
strings: pooled `DATABASE_URL` (app role, RLS applies) and `DATABASE_URL_UNPOOLED` (owner,
migrations only). Note: the app role is *not* superuser, so a query missing tenant context returns
**zero rows**, not an error — the conformance test below is what catches that.

**Layer 3 — a conformance test** (`tests/security/tenancy.conformance.test.ts`). Every table must be
in exactly one of three exported sets — `TENANT_SCOPED`, `GLOBAL_OR_SCOPED` (capped, nullable
`tenant_id` = shared platform catalogue), `PLATFORM` — and the test parses the migration SQL to
assert each `TENANT_SCOPED` table has a `NOT NULL tenant_id`, an FK to `tenants`, and at least one
index whose **first** column is `tenant_id`. An unclassified table throws at query time.

**Two identity realms.** Merchants/staff/platform-admins are one realm (Better Auth, organization
plugin, cookie `bh_session`). Storefront customers are a *separate* realm — a customer of store A is
not a customer of store B, and the same email can exist in both. Better Auth assumes globally unique
emails, so customers get their own minimal session implementation (argon2 + signed httpOnly cookie
scoped to the storefront host, sessions re-checked per request) rather than being forced into
Better Auth's user table. This is ~200 lines and avoids fighting the library.

### 2. The page schema and the single renderer

This is the product's core invention and blueprint §63's hard rule: **never store generated HTML as
the canonical source.**

```ts
SiteDocument = { schemaVersion, theme: ThemeTokens, pages: Page[] }
Page         = { id, slug, title, seo, sections: Section[] }
Section      = { id, type: SectionType, props, responsive: { tablet?, mobile? },
                 children?: Node[], visible, locked }
```

`lib/render/registry.tsx` maps each `SectionType` to `{ Component, propsSchema (zod), defaults,
inspector, capabilities }`. **An unregistered type is rejected at validation, never rendered.** The
registry is consumed by exactly three callers, which is what guarantees the editor matches the live
site:

1. `components/builder/Canvas.tsx` — client, wraps each section in selection/drag affordances.
2. `app/(storefront)/store/[slug]/[[...path]]/page.tsx` — React Server Component, per-request SSR.
3. `app/(storefront)/preview/[versionId]/...` — the same RSC path against an unpublished version.

Theme tokens compile to CSS custom properties (`lib/render/theme-css.ts`) injected per store, so a
theme change is a variable swap, never a re-render of the component tree.

### 3. Draft, publish, versioning

```text
canvas edit → local editor state (command/undo stack)
            → debounced autosave → websites.draft_state (JSONB) + draft_revision++
            → publish: validate → immutable site_versions row → websites.published_version_id
            → revalidateTag(`site:${websiteId}`)
```

Optimistic concurrency: the client sends `expected_revision`; the server accepts only if it is still
current, else returns 409 for the editor to resolve. Published versions are immutable, so rollback
is just repointing `published_version_id`. The live storefront never reads `draft_state`.

### 4. Money, orders, payments

- All money is `bigint` minor units + an explicit `currency` column. No floats anywhere (§103).
- Order items snapshot product name, variant, SKU, unit price, discount and tax at purchase time —
  old orders never depend on today's product row.
- `lib/commerce/orders.ts` holds the §75 state machine; transitions are validated server-side and
  the browser can never set `PAID`.
- `lib/payments/provider.ts` defines `createPaymentIntent / getPaymentStatus / capturePayment /
  refundPayment / cancelPayment / verifyWebhook`; `dummy.ts` implements success/failure/pending/
  timeout/refund outcomes with generated transaction ids. Order logic depends only on the
  normalised states, so Razorpay/Stripe drop in later.
- Idempotency keys on checkout, order creation, payment, refund, publish and domain connection.
- Inventory changes only inside a transaction, with an `inventory_movements` history row.

### 5. Storefront routing

`middleware.ts` resolves the request host:

| Situation | Resolution |
|---|---|
| Custom merchant domain | `domains` lookup on `normalized_hostname` (globally unique) |
| `<slug>.storefront-domain` | slug extraction, once a domain exists |
| `<slug>.lvh.me:3000` (dev) | same code path, no DNS needed |
| `/s/:slug` (always) | fallback that works with no domain at all |

All four rewrite to `/store/[slug]/...`. Hot hostname→website lookups are cached with
`unstable_cache` tagged `host:<hostname>`, busted on domain change. Old slugs are retained and 308
to the current one, as FolioForge does.

---

## Phase plan

Every phase runs the **Delivery rhythm** loop above: build → tests green → used by hand on
localhost in both themes at both widths → fixes → commit → push to `main` → check in with you.

### Phase 0 — Foundations (no product features)

- `git init` **inside** `BuilderHut`, `.gitignore` before anything else, remote set to the GitHub
  repo, first commit. Commit `docs/blueprint.md` (the supplied spec) so it lives with the code.
- Next.js 16 + React 19 + TS strict, pnpm, Tailwind v4 CSS-first, Vitest, Playwright, ESLint,
  Prettier. A `pnpm verify` gate chaining typecheck, lint, unit, build, contrast, a11y, budget.
- `styles/tokens.css`: the full warm-editorial token system (§38/§40) — surfaces, text, borders,
  clay accent, status, chart colours, radii, shadows, motion durations/easings, safe-area vars,
  `@theme inline` mapping, and a duplicated `[data-theme='dark']` block so an explicit choice wins.
  **Tailwind v4 colour tokens must be named `--color-*`; a wrong name renders black.** No raw hex
  in any component. Type pairing (serif display + grotesque UI) loaded and scaled here.
- A `/dev/theme` preview page rendering every token, type scale and primitive in both modes — so
  the identity is something you can look at on localhost at the end of Phase 0.
- `lib/db/client.ts` (Neon WS pool `max: 1` in prod, node-postgres locally), `tenant.ts`,
  `_shared.ts` (uuidv7 `primaryId`, `timestamptz` everywhere), drizzle config pointed at
  `DATABASE_URL_UNPOOLED`, `scripts/normalise-journal.mjs` chained into `db:generate`.
- `sql/roles.sql` creating `builderhut_app`; migration 0001 with RLS enabled on tenant tables.
- GitHub Actions: fast no-DB quality job + a DB-backed integration job.

*Verify:* `pnpm verify` green; `pnpm db:migrate` applies against Neon; a scratch test proves the app
role sees zero rows without tenant context and correct rows with it; `/dev/theme` reviewed on
localhost in both modes. Then commit and push to `main`.

### Phase 1 — Landing page, auth, onboarding, tenants, products, one template

- **The marketing landing page** to the §0.1 bar (detailed above), plus `/templates` with the §45
  full-browser template preview experience and device toggles.
- Better Auth wired to Drizzle: email+password, emailOTP for the §4.3 six-digit code (hashed,
  short expiry, attempt limit, resend cooldown, rate limited, audited), organization plugin mapped
  to `tenants`/`tenant_members`, admin plugin for the platform realm. Google/GitHub configured but
  optional.
- The §4.4 wizard: industry → business name → sales channel → goals → currency/region → brand
  basics → template recommendations. Creates the tenant, website and owner membership in one
  transaction.
- Design system primitives (§38) and the dashboard shell (§9 sidebar, collapsible, command palette,
  toasts, drawers) in both themes.
- Products, categories, media library (R2 presigned upload, magic-byte sniffing, content-hash
  naming, client-side downscale before upload), variants, inventory basics.
- One complete template end to end, rendered by the registry at `/s/:slug`.

*Verify:* landing page reviewed on localhost at desktop and phone width, both modes; then signup →
code → wizard → store exists → add product with image → public store page renders it, clicked
through by hand and covered by Playwright. Then commit and push to `main`.

### Phase 2 — The visual builder

- Three-column layout (§6.1), canvas dominant. dnd-kit for section/component drag with insertion
  indicators, snap guides, multi-select, duplicate/delete, lock/hide, breadcrumb path.
- Contextual inspector (§6.4) driven by each registry entry's `inspector` descriptor — only the
  controls relevant to the selection.
- Global theme editor (§6.5), responsive overrides per breakpoint without page duplication (§6.6).
- Command/history undo-redo (§6.7, not snapshot diffing), debounced autosave with offline local
  persistence (§6.8), version history and restore (§6.9).
- Page manager (§7) including undeletable system pages.
- Keyboard shortcuts, command palette, device preview, one-click preview.

*Verify:* reorder sections, edit copy/colour/image, resize to mobile, undo 20 steps, reload and find
the draft intact, restore a previous version.

### Phase 3 — Commerce

Cart, checkout (configurable modes/fields per §10), dummy payment gateway with test cards, order
creation with idempotency, order management and quick actions, customers + timeline, discounts,
shipping zones/methods, configurable tax rules with GSTIN/HSN fields, storefront customer accounts
and order history, wishlist, reviews.

*Verify:* a visitor buys a product with each dummy outcome (success/fail/pending/refund); the
merchant sees the order, refunds it, and revenue reconciles; a duplicate POST creates one order.

### Phase 4 — Hosting, publish, domains

Slug selection with reserved/blocked lists, the §59 publish flow with the §19/§92 readiness
checklist (critical vs warning vs recommendation), deployment progress choreography, the domain
model + verification timeline UI (§29), primary domain with alternates redirecting, and the
registrar abstraction for future domain purchase.

*Verify:* publish, open the public store, unpublish, republish, roll back a version. Custom-domain
verification is exercised against a mock resolver until a real domain exists.

### Phase 5 — Analytics

The §16 event model written to `analytics_events` with a retention policy, a nightly Vercel Cron
rollup into `analytics_daily_rollups`, and the merchant analytics dashboard (§16) with real
comparison periods — every delta labelled with the period it compares to.

### Phase 6 — Platform admin console

Overview KPIs, store explorer, user explorer, website monitoring, template analytics, the revenue
console that keeps **merchant GMV and platform revenue as separate ledgers** (§17, §97), error
centre, audit log viewer, suspend/restore, and the §68 store detail command centre.

### Phase 7 — Polish

The motion system (§39) on `motion` v13 with `prefers-reduced-motion` respected throughout; the
remaining templates to 12+, each held to the rule that **no two templates may share a composition,
type personality, product-card treatment and motion profile** — a checklist enforced at review, not
a recolour; the AI assistant (§26/§64) as allowlisted structured ops validated against the page
schema, backed by NVIDIA NIM behind `lib/ai/provider.ts` with a deterministic mock for tests;
accessibility pass (§52); deliberate mobile layouts (§54) rather than narrowed desktop; every empty,
loading, partial-failure, retry, permission-denied and not-found state (§41/§42).

### Phase 8 — Growth

Plans/entitlements as a server-side service (§47), real payment providers behind the existing
abstraction, domain purchasing, template marketplace metadata, staff accounts exposed, marketing
tools, integrations.

### Then — deploy

Only after Phase 8 passes its localhost review: Neon staging/production branches, secrets moved to
Vercel environment variables (never in the repo), a rehearsed restore test before the first real
merchant, then the Vercel deploy and a full production smoke run of the §105 journey.

---

## Verification

- **Unit** (Vitest): money arithmetic, discount stacking, tax inclusive/exclusive, shipping rate
  selection, cart totals, the order/payment state machine, authorization policy, domain validation,
  slug rules, page-schema validation.
- **Integration**: signup → verification → store creation → product → checkout → dummy payment →
  order → refund → publish → domain mapping, against a real Postgres.
- **Security** (non-negotiable): cross-tenant read/write attempts by ID substitution on every
  tenant-owned resource; the tenancy conformance test; RLS proof that the app role returns zero rows
  without context; session misuse and privilege escalation.
- **E2E** (Playwright): merchant creates a store, customises a template, publishes; a customer buys;
  the platform admin sees the store, its traffic and its revenue.
- **Continuous gate**: `pnpm verify` — typecheck, lint, unit, build, WCAG contrast of every token
  pair, axe a11y, bundle budget (the storefront budget is separate and strict; the builder bundle
  must never reach a storefront).
- **Manual, per screen**: I'll run the app and look at it before calling a screen done — light and
  dark, desktop and phone.

---

## Known traps this plan already routes around

| Trap | Mitigation |
|---|---|
| `git` in `BuilderHut` targets the Wedding repo at `/Users/akash/Documents` | `git init` inside BuilderHut first, verified before any commit |
| Nested `withTenant` deadlocks on Neon `max: 1` — passes locally | `AsyncLocalStorage` guard that throws |
| Drizzle correlated subqueries silently return 0 without a qualified column | `col(table, column)` helper, used in every subquery |
| Tailwind v4 tokens must be `--color-*` or they render black | Token naming enforced in `tokens.css`, contrast script catches regressions |
| The app role is not superuser, so RLS makes leaks look like empty results | Conformance test + explicit cross-tenant security tests |
| Drizzle silently skips migrations with non-increasing timestamps | `normalise-journal.mjs` chained into `db:generate` |
| `SET` doesn't survive PgBouncer | `SET LOCAL` inside the transaction, always |
| Neon HTTP driver can't do interactive transactions | WebSocket pool driver in production |
| Templates collapsing into one recoloured layout | Per-template distinctness checklist enforced at review |
| Builder bundle leaking into public storefronts | Separate bundle budget, checked in CI |

---

## Open assumptions

- Storefront customer sessions are hand-rolled rather than a second Better Auth instance, because
  Better Auth assumes globally unique emails and customers must be unique *per store*. If you'd
  rather force Better Auth into that role, say so before Phase 3.
- Background jobs run on Vercel Cron + a `jobs` table rather than Cloudflare Queues, since we're not
  on Workers. Same retry/dead-letter semantics, one less vendor.
- Raw analytics events live in Postgres with short retention plus nightly rollups. If event volume
  ever outgrows that, the `lib/analytics/track.ts` interface is the single swap point.
