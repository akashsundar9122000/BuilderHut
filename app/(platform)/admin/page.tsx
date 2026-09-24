import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardBody } from "@/components/ui";
import { TrendChart } from "@/components/dashboard/Charts";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadAuditLog, loadOverview, loadPlatformTrend, loadTemplateUsage } from "@/lib/platform/queries";
import { loadIncidentSummary } from "@/lib/platform/incidents";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Platform overview" };

export default async function AdminOverviewPage() {
  const actor = await requirePlatformAdmin();
  const [overview, trend, templates, activity, incidents] = await Promise.all([
    loadOverview(actor.userId),
    loadPlatformTrend(actor.userId, 30),
    loadTemplateUsage(actor.userId),
    /*
     * The audit log again, short. Deliberately the same query the audit page
     * runs rather than a second one shaped for this card: two queries claiming
     * to be "what happened" that could disagree is worse than one that is a
     * little more than this needs.
     */
    loadAuditLog(actor.userId, 14),
    loadIncidentSummary(actor.userId),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Platform overview</h1>
        <p className="text-muted mt-1.5 text-sm">Last 30 days unless stated otherwise.</p>
      </header>

      {/*
        Two ledgers, kept apart on purpose — blueprint sections 17 and 97.
        Merchant GMV is their money passing through; platform revenue is what
        BuilderHut earns. Adding them together would flatter these numbers by a
        factor of a hundred.
      */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-muted text-xs tracking-[0.12em] uppercase">Merchant sales (GMV)</p>
            <p className="font-display mt-2 text-4xl tabular-nums">
              {formatMoney(overview.gmvMinor, "INR")}
            </p>
            <p className="text-muted mt-1.5 text-sm">
              {overview.orders} order{overview.orders === 1 ? "" : "s"}
              {overview.refundedMinor > 0
                ? ` · ${formatMoney(overview.refundedMinor, "INR")} refunded`
                : ""}
            </p>
            <p className="text-faint mt-3 text-xs leading-relaxed">
              This is what merchants sold. It is their money, not BuilderHut&rsquo;s, and it
              never appears in platform revenue.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-muted text-xs tracking-[0.12em] uppercase">Platform revenue</p>
            <p className="font-display mt-2 text-4xl tabular-nums">
              {formatMoney(overview.platformRevenueMinor, "INR")}
            </p>
            <p className="text-muted mt-1.5 text-sm">No fees or subscriptions yet</p>
            <p className="text-faint mt-3 text-xs leading-relaxed">
              Zero, honestly. Transaction fees and plans are designed and not built, so
              BuilderHut has earned nothing from these shops.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Shops" value={overview.stores} note={`${overview.publishedStores} published`} />
        <Stat label="People" value={overview.users} note={`${overview.merchants} own a shop`} />
        <Stat label="Products" value={overview.products} note="across every shop" />
        <Stat
          label="Visitors"
          value={overview.visitors}
          note={`${overview.pageViews.toLocaleString()} page views`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardBody>
              <h2 className="font-display text-lg">New shops</h2>
              <p className="text-muted mb-4 text-xs">
                {overview.newStores7d} in the last 7 days · {overview.newStores30d} in 30
              </p>
              <TrendChart
                series={1}
                data={trend.map((d) => ({ day: d.day, value: d.stores }))}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-display text-lg">Merchant sales</h2>
              <p className="text-muted mb-4 text-xs">
                Across every shop. In hundreds of INR.
              </p>
              <TrendChart
                series={3}
                format="money"
                data={trend.map((d) => ({ day: d.day, value: d.gmvMinor }))}
              />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardBody>
              <h2 className="font-display text-lg">Templates</h2>
              <p className="text-muted mb-4 text-xs">Which starting points get chosen.</p>
              {templates.length === 0 ? (
                <p className="text-muted text-sm">No shops yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {templates.map((t) => (
                    <li key={t.templateId} className="flex items-baseline justify-between text-sm">
                      <span className="text-text-secondary capitalize">{t.templateId}</span>
                      <span className="text-text tabular-nums">
                        {t.installs}
                        <span className="text-muted text-xs"> · {t.published} live</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-display text-lg">Needs attention</h2>
              {/*
                * Incidents first. A suspended shop is a decision somebody made;
                * an outstanding incident is something broken that nobody has
                * looked at, which is the more urgent of the two.
                */}
              {incidents.outstanding > 0 ? (
                <p className="text-danger mt-2 text-sm">
                  {incidents.outstanding} unresolved incident
                  {incidents.outstanding === 1 ? "" : "s"}
                  {incidents.errors24h > 0 ? ` · ${incidents.errors24h} today` : ""}
                </p>
              ) : (
                <p className="text-muted mt-2 text-sm">Nothing is failing.</p>
              )}
              {overview.suspendedStores > 0 ? (
                <p className="text-warning mt-1 text-sm">
                  {overview.suspendedStores} suspended shop
                  {overview.suspendedStores === 1 ? "" : "s"}
                </p>
              ) : null}
              <div className="mt-3 flex flex-col gap-1.5">
                <Link
                  href="/admin/incidents"
                  className="text-accent hover:text-accent-hover text-sm underline underline-offset-4"
                >
                  Open incidents
                </Link>
                <Link
                  href="/admin/stores"
                  className="text-accent hover:text-accent-hover text-sm underline underline-offset-4"
                >
                  Open the store explorer
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardBody>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg">Activity</h2>
            <Link
              href="/admin/audit"
              className="text-accent hover:text-accent-hover text-sm underline underline-offset-4"
            >
              Full audit log
            </Link>
          </div>

          {activity.length === 0 ? (
            <p className="text-muted text-sm">Nothing has happened yet.</p>
          ) : (
            <ol className="divide-border divide-y">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                  <span className="text-faint w-20 shrink-0 text-xs tabular-nums">
                    {ago(entry.createdAt)}
                  </span>
                  <span className="text-text-secondary font-mono text-xs">{entry.action}</span>
                  <span className="text-text min-w-0 flex-1 truncate text-sm">
                    {entry.tenantName ?? "—"}
                  </span>
                  <span className="text-muted shrink-0 text-xs">{entry.actorEmail ?? "system"}</span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * How long ago, in as few characters as the column allows.
 *
 * Rendered on the server, so it is the age at render time rather than a live
 * ticking clock — which for a page somebody opens, reads and leaves is the
 * honest thing, and avoids a client component and a hydration mismatch for the
 * sake of a number that changes once a minute.
 */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-muted text-xs tracking-[0.12em] uppercase">{label}</p>
        <p className="font-display mt-2 text-3xl tabular-nums">{value.toLocaleString()}</p>
        <p className="text-muted mt-1 text-xs">{note}</p>
      </CardBody>
    </Card>
  );
}
