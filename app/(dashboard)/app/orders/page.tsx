import Link from "next/link";
import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { ShoppingBag } from "lucide-react";

import { Badge, Card, EmptyState } from "@/components/ui";
import { runForTenant } from "@/lib/auth/session";
import { orders } from "@/lib/db/schema";
import { LABELS, TONES, type OrderStatus } from "@/lib/commerce/order-state";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const rows = await runForTenant((db) =>
    db.select(orders).orderBy(desc(orders.createdAt)).limit(100),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Orders</h1>
        <p className="text-muted mt-1.5 text-sm">
          {rows.length === 0
            ? "Everything customers buy will land here."
            : `${rows.length} order${rows.length === 1 ? "" : "s"} so far.`}
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag />}
          title="No orders yet"
          description="Once someone buys from your shop, their order appears here with everything you need to pack it."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {rows.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/app/orders/${order.id}`}
                  className="hover:bg-raised flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors sm:px-5"
                >
                  <span className="text-text w-16 shrink-0 font-mono text-sm">#{order.number}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-text truncate text-sm">{order.email}</p>
                    <p className="text-muted text-xs">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="text-text text-sm tabular-nums">
                    {formatMoney(order.totalMinor, order.currency)}
                  </span>
                  <Badge tone={TONES[order.status as OrderStatus]}>
                    {LABELS[order.status as OrderStatus]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
