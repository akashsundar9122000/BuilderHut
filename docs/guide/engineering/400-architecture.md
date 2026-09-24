---
title: Architecture at a glance
summary: The five surfaces, the one door to merchant data, and the single renderer behind the builder and the live shop.
who: Contributors
icon: layers
related: welcome
---

BuilderHut is one Next.js application serving five surfaces from six route groups, one
Postgres database with per-shop isolation enforced twice, and one rendering registry that draws
both the builder's canvas and the published storefront.

:::note This page describes what the code does today
`docs/blueprint.md` is the product specification and records intent and rationale; this guide
records behaviour. Where they disagree, the code is right and the blueprint is history. Two
prose copies of the tenancy model is one copy that eventually lies.
:::

## The five surfaces

| Route group | Serves | Audience |
|---|---|---|
| `(marketing)` | `/`, `/templates`, `/guide` | anyone |
| `(auth)` · `(onboarding)` | signing up, the six-digit code, the setup wizard | a new merchant |
| `(dashboard)` | `/app/*` — the merchant console | a signed-in member of one shop |
| `(builder)` | `/app/builder` and its preview | the same, full screen |
| `(storefront)` | `/s/[slug]/*` | shoppers, and search engines |
| `(platform)` | `/admin/*` | the platform operator, across all shops |

`middleware.ts` runs before any of it and does three jobs: rewriting a merchant's custom domain
onto the same `/s/<slug>` route the BuilderHut address uses, setting first-party visitor cookies
for that shop's analytics, and redirecting alternate domains to the primary one.

## The one door

:::danger Every tenant-owned read and write goes through `withTenant()`
`lib/db/tenant.ts` is the only way to reach merchant data. It opens one transaction, publishes
the shop's identity into Postgres session settings, and hands back a query builder that injects
the tenant predicate at execution time. Forgetting is meant to be impossible rather than
discouraged: `select()` applies the scope when the query runs so there is no terminal call to
omit, `insert()` strips any tenant id the caller supplied, and a table nobody has classified
throws instead of returning unscoped rows.
:::

Underneath it, **row-level security** is a silent backstop. The application connects as
`builderhut_app`, which is `NOBYPASSRLS`; migrations connect as the owner.

The practical consequence when debugging: a query that loses its tenant context returns **zero
rows, not an error**. An empty dashboard is far more often a missing context than missing data.

## One renderer, three surfaces

The builder's canvas is not a preview. `lib/render/registry.tsx` maps a section type to a React
component and a props schema, and `lib/render/render.tsx` turns a document into React. The
builder, the draft preview and the published storefront all call that same function, so there
is no second implementation to drift.

:::steps
### A page is a document, not markup

`lib/schema/page.ts` defines sections, their props and their per-breakpoint overrides. Structure
is canonical; HTML never is.

### Editing is a command, not a mutation

`lib/builder/commands.ts` expresses every edit as data. Applying one is pure, and undo is the
command itself rather than a snapshot diff — which is why typing a heading is one undo step and
not forty.

### Publishing re-renders from validated JSON

`lib/builder/service.ts` validates the draft, writes an immutable row to `site_versions`, and
repoints `published_version_id`. Rolling back is choosing an earlier version, not undoing
anything.
:::

## Where to look first

:::faq
### An empty dashboard

Almost always a missing tenant context rather than missing data. See the one door, above.

### A colour that renders black

Tailwind v4 tokens must be named `--color-*` or they do not resolve. `styles/tokens.css` is the
only source of colour in the product, and `pnpm check:contrast` fails the build if any token
pair drops below WCAG AA in either theme.

### A migration that seems not to have run

Drizzle silently skips a migration whose timestamp does not strictly increase.
`scripts/db/normalise-journal.mjs` is chained into `pnpm db:generate` for exactly this reason.

### A storefront that looks like BuilderHut

`lib/render/theme-css.ts` scopes a merchant's palette to `[data-storefront]` so it cannot leak
into our chrome — and our theme cannot reach in and repaint their brand.
:::
