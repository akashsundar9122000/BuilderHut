import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { AccountShell } from "@/components/storefront/AccountShell";
import { statusLabel } from "@/components/storefront/OrderTimeline";
import { orderItems, orders } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { formatMoney } from "@/lib/money";
import { loadAccountPage } from "@/lib/storefront/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your orders", robots: { index: false } };

export default async function AccountOrdersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { ctx, store, customer } = await loadAccountPage(slug, "/account/orders");

  const rows = await withTenant(
    { tenantId: store.tenantId, actorId: store.tenantId, role: "staff" },
    async (db) => {
      const found = await db
        .select(orders)
        .where(eq(orders.customerId, customer.customerId))
        .orderBy(desc(orders.createdAt))
        .limit(50);
      // One query for the line counts rather than one per order.
      const lines = found.length ? await db.select(orderItems) : [];
      const countFor = new Map<string, number>();
      for (const line of lines) {
        countFor.set(line.orderId, (countFor.get(line.orderId) ?? 0) + line.quantity);
      }
      return found.map((order) => ({ order, items: countFor.get(order.id) ?? 0 }));
    },
  );

  return (
    <AccountShell ctx={ctx} slug={slug} title="Your orders" active="orders">
      {rows.length === 0 ? (
        <p style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)" }}>
          Nothing here yet. Your orders will appear once you place one.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {rows.map(({ order, items }) => (
            <li
              key={order.id}
              style={{
                background: "var(--sf-surface)",
                border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
                borderRadius: "var(--sf-radius)",
                padding: 16,
                fontFamily: "var(--sf-font-body)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <a
                  href={`${ctx.base}/account/orders/${order.id}`}
                  style={{ color: "var(--sf-text)", fontSize: "1rem", textDecoration: "underline" }}
                >
                  Order #{order.number}
                </a>
                <span style={{ color: "var(--sf-muted)", fontSize: "0.9rem" }}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <div style={{ color: "var(--sf-muted)", fontSize: "0.88rem", marginTop: 6 }}>
                {items} {items === 1 ? "item" : "items"} ·{" "}
                {formatMoney(order.totalMinor, order.currency)}
                {order.placedAt
                  ? ` · ${order.placedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                  : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
