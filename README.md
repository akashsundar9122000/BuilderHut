# BuilderHut

A multi-tenant store builder. Someone who makes things — crochet, invitations, cakes,
jewellery, prints — signs up, answers a few questions, picks a template for their trade,
customises it visually, adds their products, and publishes a real shop with a cart and a
checkout. No code, and no "looks like every other SaaS" either.

Status: **built.** All eight phases have shipped — landing page, auth, onboarding, twelve
templates, the visual builder, commerce, publish, domains, analytics, the platform console,
plans, staff accounts and payments. See `docs/plan.md` for the phase sequence and
`docs/blueprint.md` for the full specification.

The guide lives at `/guide` and is written in `docs/guide/`. Its engineering section is the
place to start if you are new to this codebase; run `pnpm guide:build` after editing a page,
and `pnpm check:guide` will tell you if you forgot.

## Running it

```bash
pnpm install
cp .env.example .env.local     # fill in the Neon URLs
pnpm db:roles                  # create the NOBYPASSRLS app role (once per environment)
pnpm db:migrate
pnpm dev
```

Then open `/dev/theme` to see the design system.

## The parts that matter

**`lib/db/tenant.ts`** is the only door to merchant data. Every tenant-owned read and
write goes through `withTenant()`, which opens one transaction, publishes the tenant
context into Postgres session settings, and hands back a query builder that injects the
tenant predicate for you. Forgetting is meant to be impossible rather than discouraged —
`select()` applies the scope at execution time so there is no terminal call to omit,
`insert()` strips any caller-supplied tenant id, and an unclassified table throws instead
of returning unscoped rows.

**Row-level security** sits underneath that as a silent backstop. The application connects
as `builderhut_app`, which is `NOBYPASSRLS`; migrations connect as the owner. The practical
consequence when debugging: a query that loses its tenant context returns **zero rows**, not
an error. An empty dashboard is far more often a missing context than missing data.

**`styles/tokens.css`** is the single source of colour. No raw hex in a component, ever.
`pnpm check:contrast` fails the build if any token pair drops below WCAG AA in either theme.

## Commands

| | |
|---|---|
| `pnpm dev` | development server |
| `pnpm verify` | the full gate: contrast, guide, types, lint, tests, build, secrets, bundle budget |
| `pnpm guide:build` | compile `docs/guide/**.md` into `lib/guide/*.generated.ts` |
| `pnpm test` | unit, integration and cross-tenant security tests |
| `pnpm db:generate` | generate a migration from the schema (and normalise the journal) |
| `pnpm db:migrate` | apply migrations, as the owner role |
| `pnpm db:roles` | create/refresh the application role |

## Two connection strings, on purpose

`DATABASE_URL` is the pooled endpoint as the app role — RLS applies to it.
`DATABASE_URL_UNPOOLED` is the direct endpoint as the owner — migrations only, because DDL
needs a real session to hold an advisory lock and PgBouncer cannot give it one.
