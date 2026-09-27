import type { Metadata } from "next";

import { Card, CardBody } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform/guard";
import { loadOverview, loadStores } from "@/lib/platform/queries";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Revenue" };

export default async function AdminRevenuePage() {
  const actor = await requirePlatformAdmin();
  const [overview, stores] = await Promise.all([
    loadOverview(actor.userId),
    loadStores(actor.userId),
  ]);

  const net = overview.gmvMinor - overview.refundedMinor;
  const top = [...stores].sort((a, b) => b.gmvMinor - a.gmvMinor).slice(0, 10);

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Revenue</h1>
        <p className="text-muted mt-1.5 text-sm">
          Two separate ledgers. They are never added together.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="font-display text-lg">Merchant money</h2>
            <p className="text-muted mt-1 text-xs">
              Passing through BuilderHut. None of it is ours.
            </p>
            <dl className="mt-5 flex flex-col gap-2.5 text-sm">
              <Row label="Gross sales" value={formatMoney(overview.gmvMinor, "INR")} />
              <Row label="Refunds" value={`−${formatMoney(overview.refundedMinor, "INR")}`} />
              <Row label="Net merchant sales" value={formatMoney(net, "INR")} strong />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="font-display text-lg">BuilderHut&rsquo;s money</h2>
            <p className="text-muted mt-1 text-xs">What the platform actually earns.</p>
            <dl className="mt-5 flex flex-col gap-2.5 text-sm">
              <Row label="Transaction fees" value={formatMoney(0, "INR")} />
              <Row label="Subscriptions" value={formatMoney(0, "INR")} />
              <Row label="Domains" value={formatMoney(0, "INR")} />
              <Row label="Platform revenue" value={formatMoney(0, "INR")} strong />
            </dl>
            <p className="text-faint mt-4 text-xs leading-relaxed">
              Zero, and it should be. Fees, plans and domain sales are designed and not
              built, so nothing has been charged to anyone.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-5">
        <CardBody>
          <h2 className="font-display text-lg">Busiest shops</h2>
          <p className="text-muted mb-4 text-xs">By merchant sales, all time.</p>
          {top.length === 0 || top[0]?.gmvMinor === 0 ? (
            <p className="text-muted text-sm">Nobody has sold anything yet.</p>
          ) : (
            /*
             * A real table rather than a row with the two ends pushed apart.
             *
             * `justify-between` was fine in a 1024px card and stopped being
             * fine the moment the page filled the screen: the name sat at one
             * edge and the figure at the other, a metre apart, with nothing in
             * between for the eye to follow. Columns keep the numbers in a
             * line and the eye travels down them instead of across.
             */
            <table className="w-full text-sm">
              <caption className="sr-only">Shops by merchant sales, all time</caption>
              <thead>
                <tr className="border-border text-muted border-b text-left">
                  <th scope="col" className="pb-2 font-normal">Shop</th>
                  <th scope="col" className="w-28 pb-2 text-right font-normal">Orders</th>
                  <th scope="col" className="w-40 pb-2 text-right font-normal">Sales</th>
                </tr>
              </thead>
              <tbody>
                {top
                  .filter((s) => s.gmvMinor > 0)
                  .map((store) => (
                    <tr key={store.id} className="border-border border-b last:border-b-0">
                      <th scope="row" className="text-text-secondary truncate py-2.5 pr-4 text-left font-normal">
                        {store.name}
                      </th>
                      <td className="text-muted py-2.5 text-right tabular-nums">{store.orders}</td>
                      <td className="text-text py-2.5 text-right tabular-nums">
                        {formatMoney(store.gmvMinor, "INR")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "border-border text-text flex justify-between border-t pt-2.5 font-medium"
          : "text-muted flex justify-between"
      }
    >
      <dt>{label}</dt>
      <dd className={strong ? "tabular-nums" : "text-text tabular-nums"}>{value}</dd>
    </div>
  );
}
