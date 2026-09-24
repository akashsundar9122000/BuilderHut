import type { Metadata } from "next";

import { Card, CardBody } from "@/components/ui";
import { Funnel, TrendChart } from "@/components/dashboard/Charts";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadTraffic } from "@/lib/platform/queries";

export const metadata: Metadata = { title: "Traffic" };

/*
 * Traffic across every store.
 *
 * Read from analytics_daily_rollups, which is what every merchant-facing
 * analytics screen reads too — so a figure here and the same figure on a
 * merchant's own dashboard come from one source and cannot disagree.
 *
 * The device and referrer panels are the exception and say so: those columns
 * are not in the rollup, so they come from the raw events table, which has a
 * short retention. A thirty-day window there is a window over whatever has not
 * been pruned yet, and pretending otherwise would be inventing precision.
 */
export default async function AdminTrafficPage() {
  const actor = await requirePlatformAdmin();
  const traffic = await loadTraffic(actor.userId, 30);

  const visitors = traffic.days.map((d) => ({ day: d.day, value: d.visitors }));
  const views = traffic.days.map((d) => ({ day: d.day, value: d.pageViews }));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl leading-tight">Traffic</h1>
        <p className="text-muted mt-1.5 text-sm">
          Every store, last 30 days. Visitors are counted per store — somebody who
          browsed two shops is two visitors, because there is no identity shared
          between them and there is deliberately no way to build one.
        </p>
      </header>

      {/*
        * A zero here has two very different meanings and they must not look
        * alike: nobody visited, or nobody aggregated. Said plainly, with the
        * number of events still waiting, because the fix is a cron run and the
        * operator is the person who can order one.
        */}
      {traffic.freshness.unrolledEvents > 0 ? (
        <Card className="border-warning/30 bg-warning-soft mb-6 px-4 py-3">
          <p className="text-text-secondary text-sm">
            Today is counted live, and earlier days come from the nightly rollup
            {traffic.freshness.lastRollupDay
              ? `, which stops at ${traffic.freshness.lastRollupDay}`
              : ", which has never run"}
            . {traffic.freshness.unrolledEvents.toLocaleString()} event
            {traffic.freshness.unrolledEvents === 1 ? " is" : "s are"} recorded in between and
            not yet aggregated, so the days before today are undercounted.
          </p>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-5 sm:grid-cols-3">
        {[
          { label: "Visitors", value: traffic.totals.visitors },
          { label: "Page views", value: traffic.totals.pageViews },
          { label: "Orders", value: traffic.totals.orders },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-muted text-xs tracking-[0.12em] uppercase">{stat.label}</p>
              <p className="font-display mt-2 text-3xl tabular-nums">
                {stat.value.toLocaleString()}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-muted mb-3 text-xs tracking-[0.12em] uppercase">Visitors a day</p>
            <TrendChart data={visitors} series={1} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-muted mb-3 text-xs tracking-[0.12em] uppercase">Page views a day</p>
            <TrendChart data={views} series={2} />
          </CardBody>
        </Card>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardBody>
            <p className="text-muted mb-4 text-xs tracking-[0.12em] uppercase">
              Platform funnel, 30 days
            </p>
            <Funnel
              stages={[
                { label: "Visitors", value: traffic.totals.visitors },
                {
                  label: "Added to a basket",
                  value: traffic.days.reduce((n, d) => n + d.addToCarts, 0),
                },
                { label: "Ordered", value: traffic.totals.orders },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-muted mb-4 text-xs tracking-[0.12em] uppercase">Busiest shops</p>
            {traffic.topStores.length === 0 ? (
              <p className="text-muted text-sm">
                No store has had a visitor in this window yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border text-muted border-b text-left">
                    <th scope="col" className="pb-2 font-normal">Shop</th>
                    <th scope="col" className="pb-2 text-right font-normal">Visitors</th>
                    <th scope="col" className="pb-2 text-right font-normal">Orders</th>
                    <th scope="col" className="pb-2 text-right font-normal">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.topStores.map((store) => (
                    <tr key={store.slug} className="border-border border-b last:border-b-0">
                      <td className="py-2.5">
                        <span className="text-text">{store.name}</span>
                        <span className="text-faint ml-2 text-xs">/{store.slug}</span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {store.visitors.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{store.orders}</td>
                      <td className="text-muted py-2.5 text-right tabular-nums">
                        {store.conversion === null ? "—" : `${store.conversion}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Breakdown
          title="Devices"
          note="From raw events, which are pruned — recent only."
          rows={traffic.devices.map((d) => ({ label: d.device, count: d.count }))}
        />
        <Breakdown
          title="Where people came from"
          note="Referring host. Direct visits record none and are not listed."
          rows={traffic.referrers.map((r) => ({ label: r.host, count: r.count }))}
        />
      </div>
    </div>
  );
}

function Breakdown({
  title,
  note,
  rows,
}: {
  title: string;
  note: string;
  rows: { label: string; count: number }[];
}) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Card>
      <CardBody>
        <p className="text-muted text-xs tracking-[0.12em] uppercase">{title}</p>
        <p className="text-faint mt-1 mb-4 text-xs">{note}</p>
        {rows.length === 0 ? (
          <p className="text-muted text-sm">Nothing recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <li key={row.label} className="flex items-center gap-3 text-sm">
                <span className="text-text-secondary w-32 shrink-0 truncate">{row.label}</span>
                {/* The bar is decoration; the number beside it is the fact. */}
                <span aria-hidden="true" className="bg-raised h-2 flex-1 overflow-hidden rounded-full">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${total > 0 ? Math.max(2, (row.count / total) * 100) : 0}%`,
                      background: "var(--bh-chart-3)",
                    }}
                  />
                </span>
                <span className="text-text w-16 shrink-0 text-right tabular-nums">
                  {row.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
