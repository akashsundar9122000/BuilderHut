# Deploying BuilderHut

Written for: whoever is putting this on the internet, including future me.

Target is Vercel in `bom1` (Mumbai), against Neon in `ap-southeast-1`
(Singapore). Those two are close enough that a transaction's handful of round
trips costs a few milliseconds instead of the ~78ms each it costs from a laptop
in India — which is why the same page takes 3.4 seconds locally and a fraction
of that deployed.

## Before the first production deploy

Three things, in this order.

### 1. Rotate the database password

The password in `.env.local` was pasted into a chat transcript while this was
being built. It works, which is the problem. Rotate it in the Neon console
(**Roles → neondb_owner → Reset password**), then update `.env.local` and the
Vercel environment variables below.

Nothing else is blocked by this, and everything else is pointless without it.

### 2. Give production its own Neon branch

The database in `.env.local` is the development branch. At the time of writing
it holds about ninety tenants named `loom-mueg…`, `nook-mueh…` and similar —
end-to-end test artefacts, one per suite run. Production must not point at it:
the platform console would open onto ninety fake shops, and every figure on the
revenue screen would be nonsense.

In the Neon console, branch `main` into `production`, then use that branch's
pooled and unpooled URLs for the production environment. The schema travels
with the branch; `pnpm db:migrate` against it is a no-op the first time.

The dev branch can then be reset whenever the test data gets tiresome.

### 3. Create the app role on the new branch

Tenant isolation has two layers, and the second one only exists if the
application connects as a role that cannot bypass it:

```bash
psql "$DATABASE_URL_UNPOOLED" -f sql/roles.sql
```

`DATABASE_URL` must then be the **`builderhut_app`** role — `NOBYPASSRLS`, with
DML-only grants. `DATABASE_URL_UNPOOLED` stays the owner, and is used only for
migrations.

Verify it took, because a mistake here is invisible until it is a breach:

```bash
pnpm test -- tests/security
```

Those tests refuse to pass against a connection that can see across tenants.

## Environment variables

Set on the Vercel project. Nothing here belongs in the repository, and
`scripts/check-secrets.mjs` fails the build if any of it appears in a tracked
file.

| Variable | Needed | Notes |
|---|---|---|
| `DATABASE_URL` | always | Pooled, as `builderhut_app`. |
| `DATABASE_URL_UNPOOLED` | always | Owner. Migrations only. |
| `BETTER_AUTH_SECRET` | always | 32+ random characters. `openssl rand -base64 32`. |
| `APP_URL` | on a custom domain | Omit on a `.vercel.app` host: `lib/app-url.ts` derives it from Vercel's own variables. Wrong here means every sign-in fails as a CSRF rejection. |
| `CRON_SECRET` | production | Without it the cron routes close in production rather than opening. Vercel sends it automatically as a bearer token. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | for real email | Unset, codes and links are printed to the log instead. Fine for a preview, not for people. See **Deliverability** below — a working relay is not the same as a delivered email. |
| `MEDIA_STORE` | production | `kv` or `r2`. The default, `local`, writes to disk — and a serverless function's disk does not survive the request. |
| `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_KV_API_TOKEN` | with `MEDIA_STORE=kv` | |
| `R2_*` | with `MEDIA_STORE=r2` | |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | to take real money | All three or none. Half-set makes the checkout refuse rather than fall back to the simulator. |
| `NVIDIA_API_KEY`, `NVIDIA_MODEL` | optional | The builder's assistant falls back to a local rule-based planner without them, and says which answered. |

## Deploying

```bash
vercel link          # once
vercel               # preview, on its own URL
vercel --prod        # production
```

`vercel.json` pins the region to `bom1` and registers two crons: the nightly
analytics rollup and the daily unpaid-order reminders.

## Migrations

Not run by the build, deliberately — a build runs on every deployment including
previews, and a preview should not migrate production's database.

```bash
DATABASE_URL_UNPOOLED="…production…" pnpm db:migrate
```

Run it before the deployment that needs it. Every migration so far is additive,
so the old code tolerates the new schema and the order is forgiving; that will
not always be true.

## After deploying

Walk the journey the blueprint's §105 describes, on the deployed URL, because
several things only exist in production:

1. Sign up, receive the code, verify. *(Checks SMTP, and that `APP_URL` agrees
   with the origin — if sign-in reports wrong credentials for a password you
   know is right, it is this.)*
2. Complete onboarding, pick a template, land on a store.
3. Add a product **with a photograph**. *(Checks `MEDIA_STORE`: with the
   default, the upload appears to work and the image 404s on the next request.)*
4. Publish, and open the storefront.
5. Buy the product. *(With Razorpay configured, use its test mode — and check
   the order is marked paid, which proves the webhook is arriving.)*
6. Refund it from the dashboard, and check the revenue figure is net.
7. Open `/admin` as a platform operator (`pnpm admin:grant <email>`).

## Restoring

Rehearse this before the first real merchant, not after the first incident.

Neon keeps a restore window; recovery is a branch from a point in time rather
than a file to load. In the console: **Branches → Restore**, pick the moment,
and point `DATABASE_URL` at the result. What is worth rehearsing is the part
that is not automatic — knowing which moment, and how long the whole thing
takes with somebody waiting.

Media is not in the database. With `MEDIA_STORE=kv` or `r2` the objects are
content-addressed and immutable, so they survive a database restore; the rows
in `media_assets` that point at them do not, and a restored database may
reference objects that were uploaded after the restore point. Those show as
missing images, not as errors.

## Deliverability

A relay accepting a message and a person receiving it are different things, and
the gap between them is silent.

**`MAIL_FROM` must be on a domain whose SPF authorises whoever is relaying.**
Sending as `you@gmail.com` through Brevo, Resend or any other relay fails SPF,
because `gmail.com`'s SPF record authorises only Google's own servers:

```
$ dig +short TXT gmail.com
"v=spf1 redirect=_spf.google.com"
```

`gmail.com`'s DMARC is `p=none`, so Gmail will not bounce it — it accepts the
message, distrusts it, and files it in spam or drops it. The relay reports
`250 OK: queued`, the application logs a successful send, and nobody gets the
email. That is exactly what happened on 2026-09-24: signup codes were sent and
accepted and never arrived.

Three ways out, cheapest first:

1. **Send through the mailbox provider that owns the address.** For a Gmail
   sender, `smtp.gmail.com:587` with an app password. SPF aligns because Google
   really is sending it. Caps out around 500/day, which is plenty until there
   are merchants.
2. **Use a domain you own.** Add it to the relay, publish its SPF and DKIM
   records, and send from `hello@yourdomain`. This is the real answer and is
   needed for custom storefront domains anyway.
3. **Use a relay's own verified sending domain** where one is offered.

Whichever it is, check the relay's own delivery log — Brevo's is under
**Transactional → Logs** — which distinguishes delivered, soft-bounced, blocked
and spam-reported. The application cannot see any of that; it only knows the
relay said yes.

One more thing worth knowing: hard bounces poison a sending reputation, and a
relay will start blocking an account that produces them. Sending to addresses
at a domain that does not exist — `@builderhut.test`, say, which the test suite
used to do — is the easiest way to cause that. Check the relay's blocked-contact
list if delivery degrades.
