import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { AccountShell } from "@/components/storefront/AccountShell";
import { OrderTimeline, statusLabel } from "@/components/storefront/OrderTimeline";
import { orderAddresses, orderItems, orders } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { formatMoney } from "@/lib/money";
import { loadAccountPage } from "@/lib/storefront/account";

/*
 * One of somebody's own orders.
 *
 * Distinct from /order/[orderId], which is the receipt anyone holding the link can
 * see — deliberately, because a guest who has just paid has no account to sign
 * into. This one requires the order to be THEIRS, and carries the timeline.
 */

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const { ctx, store, customer } = await loadAccountPage(slug, `/account/orders/${orderId}`);

  const data = await withTenant(
    { tenantId: store.tenantId, actorId: store.tenantId, role: "staff" },
    async (db) => {
      const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
      // Somebody else's order is not found rather than forbidden: confirming it
      // exists is information too.
      if (!order || order.customerId !== customer.customerId) return null;
      const items = await db.select(orderItems).where(eq(orderItems.orderId, orderId));
      const [address] = await db
        .select(orderAddresses)
        .where(eq(orderAddresses.orderId, orderId))
        .limit(1);
      return { order, items, address: address ?? null };
    },
  );

  if (!data) notFound();
  const { order, items, address } = data;

  return (
    <AccountShell
      ctx={ctx}
      slug={slug}
      title={`Order #${order.number}`}
      lede={statusLabel(order.status)}
      active="orders"
    >
      <div style={{ display: "grid", gap: 28, fontFamily: "var(--sf-font-body)" }}>
        <section
          style={{
            background: "var(--sf-surface)",
            border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
            borderRadius: "var(--sf-radius)",
            padding: 20,
          }}
        >
          <OrderTimeline order={order} />
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--sf-font-heading)", fontSize: "1.05rem", margin: 0 }}>
            What you ordered
          </h2>
          <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 10 }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: "0.9rem" }}
              >
                <span>
                  {item.productName}
                  <span style={{ color: "var(--sf-muted)" }}> × {item.quantity}</span>
                </span>
                <span>{formatMoney(item.lineTotalMinor, order.currency)}</span>
              </li>
            ))}
          </ul>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 14,
              paddingTop: 14,
              borderTop: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              fontSize: "0.95rem",
            }}
          >
            <span>Total</span>
            <span>{formatMoney(order.totalMinor, order.currency)}</span>
          </div>
        </section>

        {address ? (
          <section>
            <h2 style={{ fontFamily: "var(--sf-font-heading)", fontSize: "1.05rem", margin: 0 }}>
              Where it went
            </h2>
            <address
              style={{ fontStyle: "normal", marginTop: 12, fontSize: "0.9rem", lineHeight: 1.6 }}
            >
              {[
                address.name,
                address.line1,
                address.line2,
                [address.city, address.region, address.postalCode].filter(Boolean).join(" "),
                address.country,
              ]
                .filter(Boolean)
                .map((line) => (
                  <div key={String(line)}>{line}</div>
                ))}
            </address>
          </section>
        ) : null}
      </div>
    </AccountShell>
  );
}
