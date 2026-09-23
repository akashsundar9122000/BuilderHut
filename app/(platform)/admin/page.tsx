import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardBody } from "@/components/ui";
import { TrendChart } from "@/components/dashboard/Charts";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadOverview, loadPlatformTrend, loadTemplateUsage } from "@/lib/platform/queries";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Platform overview" };

export default async function AdminOverviewPage() {
  const actor = await requirePlatformAdmin();
  const [overview, trend, templates] = await Promise.all([
    loadOverview(actor.userId),
    loadPlatformTrend(actor.userId, 30),
    loadTemplateUsage(actor.userId),
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
              {overview.suspendedStores > 0 ? (
                <p className="text-warning mt-2 text-sm">
                  {overview.suspendedStores} suspended shop
                  {overview.suspendedStores === 1 ? "" : "s"}
                </p>
              ) : (
                <p className="text-muted mt-2 text-sm">Nothing suspended.</p>
              )}
              <Link
                href="/admin/stores"
                className="text-accent hover:text-accent-hover mt-3 inline-block text-sm underline underline-offset-4"
              >
                Open the store explorer
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
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
