import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { Card, CardBody, EmptyState } from "@/components/ui";
import { Funnel, TrendChart } from "@/components/dashboard/Charts";
import { requireActor } from "@/lib/auth/session";
import { changeVs, loadAnalytics } from "@/lib/analytics/query";
import { loadStoreSettings } from "@/lib/commerce/settings";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Analytics" };

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const actor = await requireActor();
  const { days: raw } = await searchParams;
  const windowDays = WINDOWS.some((w) => String(w.days) === raw) ? Number(raw) : 30;

  const [data, { tenant }] = await Promise.all([
    loadAnalytics(windowDays),
    loadStoreSettings(actor.tenantId!),
  ]);
  const currency = tenant?.currency ?? "INR";
  const t = data.totals;
  const hasAnything = t.pageViews > 0 || t.orders > 0;

  const conversion =
    t.visitors > 0 ? Math.round((t.orders / t.visitors) * 1000) / 10 : 0;

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight">Analytics</h1>
          <p className="text-muted mt-1.5 text-sm">
            What&rsquo;s happening on your shop, and whether it&rsquo;s getting better.
          </p>
        </div>

        {/* One filter row above the charts. */}
        <div className="bg-sunken flex items-center gap-0.5 rounded-md p-0.5">
          {WINDOWS.map((w) => (
            <Link
              key={w.days}
              href={`/app/analytics?days=${w.days}`}
              className={
                w.days === windowDays
                  ? "bg-surface text-text shadow-xs rounded px-3 py-1.5 text-xs font-medium"
                  : "text-muted hover:text-text rounded px-3 py-1.5 text-xs transition-colors"
              }
            >
              {w.label}
            </Link>
          ))}
        </div>
      </header>

      {!hasAnything ? (
        <EmptyState
          icon={<BarChart3 />}
          title="Nothing to show yet"
          description="Your numbers appear here once people start visiting. Share your shop's link and check back."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Visitors"
              value={t.visitors.toLocaleString()}
              change={changeVs(t.visitors, data.previous.visitors)}
              windowDays={windowDays}
            />
            <Stat
              label="Page views"
              value={t.pageViews.toLocaleString()}
              change={changeVs(t.pageViews, data.previous.pageViews)}
              windowDays={windowDays}
            />
            <Stat
              label="Orders"
              value={t.orders.toLocaleString()}
              change={changeVs(t.orders, data.previous.orders)}
              windowDays={windowDays}
            />
            <Stat
              label="Revenue"
              value={formatMoney(t.revenueMinor, currency)}
              change={changeVs(t.revenueMinor, data.previous.revenueMinor)}
              windowDays={windowDays}
            />
          </div>

          {/*
            One measure per chart. Visitors, orders and revenue are different
            scales; two of them on one plot with two y-axes would make the
            crossing point look meaningful when it is an artefact of the axes.
          */}
          <Card>
            <CardBody>
              <h2 className="font-display text-lg">Visitors</h2>
              <p className="text-muted mb-4 text-xs">People who opened your shop.</p>
              <TrendChart
                series={1}
                data={data.days.map((d) => ({ day: d.day, value: d.visitors }))}
              />
            </CardBody>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardBody>
                <h2 className="font-display text-lg">Orders</h2>
                <p className="text-muted mb-4 text-xs">Paid orders per day.</p>
                <TrendChart
                  series={2}
                  data={data.days.map((d) => ({ day: d.day, value: d.orders }))}
                />
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="font-display text-lg">Revenue</h2>
                <p className="text-muted mb-4 text-xs">
                  Paid orders, before refunds. In hundreds of {currency}.
                </p>
                <TrendChart
                  series={3}
                  format="money"
                  currency={currency}
                  data={data.days.map((d) => ({ day: d.day, value: d.revenueMinor }))}
                />
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card>
              <CardBody>
                <h2 className="font-display text-lg">From visit to order</h2>
                <p className="text-muted mb-5 text-xs">
                  Where people stop. The biggest drop is usually where to look first.
                </p>
                <Funnel
                  stages={[
                    { label: "Visited", value: t.visitors },
                    { label: "Looked at a product", value: t.productViews },
                    { label: "Added to basket", value: t.addToCarts },
                    { label: "Started checkout", value: t.checkoutStarts },
                    { label: "Ordered", value: t.orders },
                  ]}
                />
                <p className="text-faint mt-5 text-xs">
                  {conversion}% of visitors ordered something.
                </p>
              </CardBody>
            </Card>

            <div className="flex flex-col gap-5">
              <Card>
                <CardBody>
                  <h2 className="font-display text-lg">Where they came from</h2>
                  {data.topReferrers.length === 0 ? (
                    <p className="text-muted mt-3 text-sm">
                      Mostly people typing your link in directly, or opening it from an app.
                    </p>
                  ) : (
                    <ul className="mt-4 flex flex-col gap-2">
                      {data.topReferrers.map((r) => (
                        <li key={r.host} className="flex justify-between text-sm">
                          <span className="text-text-secondary truncate">{r.host}</span>
                          <span className="text-text tabular-nums">{r.visits}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h2 className="font-display text-lg">What they used</h2>
                  <ul className="mt-4 flex flex-col gap-2">
                    {data.devices.map((d) => (
                      <li key={d.device} className="flex justify-between text-sm capitalize">
                        <span className="text-text-secondary">{d.device}</span>
                        <span className="text-text tabular-nums">{d.sessions}</span>
                      </li>
                    ))}
                    {data.devices.length === 0 ? (
                      <li className="text-muted text-sm">Nothing recorded yet.</li>
                    ) : null}
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>
        </div>
      )}

      <p className="text-faint mt-6 text-xs leading-relaxed">
        Visitors are counted with a first-party cookie scoped to your shop alone. No
        profiles, no tracking across shops, no IP addresses kept. Raw events are discarded
        after 45 days; the daily totals above are kept.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  change,
  windowDays,
}: {
  label: string;
  value: string;
  change: number | null;
  windowDays: number;
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-muted text-xs tracking-[0.12em] uppercase">{label}</p>
        <p className="font-display mt-2 text-3xl tabular-nums">{value}</p>
        {/*
          The comparison names its own period. "+12%" on its own is the kind of
          number that means nothing — blueprint section 69 asks for the label.
        */}
        <p className="text-muted mt-1 text-xs">
          {change === null ? (
            <span className="text-faint">no earlier period to compare</span>
          ) : (
            <>
              <span className={change > 0 ? "text-success" : change < 0 ? "text-danger" : ""}>
                {change > 0 ? "+" : ""}
                {change}%
              </span>{" "}
              vs previous {windowDays} days
            </>
          )}
        </p>
      </CardBody>
    </Card>
  );
}
