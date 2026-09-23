import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { eq } from "drizzle-orm";

import { RetryPayment } from "@/components/storefront/RetryPayment";
import { StoreFooter, StoreHeader, StorePageShell } from "@/components/storefront/StoreChrome";
import { withTenant } from "@/lib/db/tenant";
import { orderAddresses, orderItems, orders } from "@/lib/db/schema";
import { LABELS, type OrderStatus } from "@/lib/commerce/order-state";
import { formatMoney } from "@/lib/money";
import { homePage } from "@/lib/schema/page";
import { loadStorefront } from "@/lib/stores/storefront";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

export default async function OrderPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>;
}) {
  const { slug, orderId } = await params;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  /*
   * Anyone holding the link can see this page, which is deliberate: a guest who
   * has just paid has no account to sign into, and emailing them a link they
   * cannot open would be worse. The id is a uuidv7 — not guessable, not
   * enumerable — and the page shows nothing beyond what the buyer already
   * knows. Signed-in order history arrives with customer accounts.
   */
  const data = await withTenant(
    { tenantId: store.tenantId, actorId: store.tenantId, role: "staff" },
    async (db) => {
      const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return null;
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
  const paid = order.status !== "pending_payment";

  const ctx = { doc: store.doc, base: `/s/${store.slug}`, products: store.products, editing: false };
  const home = homePage(store.doc);

  return (
    <>
      <StoreHeader page={home} ctx={ctx} />
      <StorePageShell
        title={paid ? "Thank you — your order is in" : "Your order is awaiting payment"}
        lede={`Order #${order.number} · a confirmation is on its way to ${order.email}`}
      >
        <div style={{ fontFamily: "var(--sf-font-body)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              background: "var(--sf-raised)",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              borderRadius: "var(--sf-radius)",
            }}
          >
            {paid ? (
              <CheckCircle2 className="size-5 shrink-0" />
            ) : (
              <Clock className="size-5 shrink-0" />
            )}
            <span style={{ fontSize: "0.92rem" }}>
              {LABELS[order.status as OrderStatus]}
              {order.shippingMethodName ? ` · ${order.shippingMethodName}` : ""}
            </span>
          </div>

          {!paid ? <RetryPayment slug={slug} orderId={order.id} /> : null}

          <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0" }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "14px 0",
                  borderBottom: "var(--sf-border-width) solid var(--sf-border)",
                  fontSize: "0.92rem",
                }}
              >
                <span style={{ flex: 1 }}>
                  {item.productName}
                  <span style={{ color: "var(--sf-muted)" }}> × {item.quantity}</span>
                </span>
                <span>{formatMoney(item.lineTotalMinor, item.currency)}</span>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 18 }}>
            <Row label="Subtotal" value={formatMoney(order.subtotalMinor, order.currency)} />
            {Number(order.discountMinor) > 0 ? (
              <Row label="Discount" value={`−${formatMoney(order.discountMinor, order.currency)}`} />
            ) : null}
            <Row
              label="Delivery"
              value={
                Number(order.shippingMinor) === 0
                  ? "Free"
                  : formatMoney(order.shippingMinor, order.currency)
              }
            />
            <Row label="Total" value={formatMoney(order.totalMinor, order.currency)} strong />
          </div>

          {address ? (
            <div style={{ marginTop: 28 }}>
              <p style={{ fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sf-muted)", margin: 0 }}>
                Delivering to
              </p>
              <p style={{ fontSize: "0.92rem", lineHeight: 1.6, marginTop: 8 }}>
                {address.name}
                <br />
                {address.line1}
                {address.line2 ? <><br />{address.line2}</> : null}
                <br />
                {[address.city, address.region, address.postalCode].filter(Boolean).join(", ")}
              </p>
            </div>
          ) : null}

          <a
            href={`/s/${slug}`}
            style={{
              display: "inline-block",
              marginTop: 32,
              padding: "12px 24px",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              borderRadius: "var(--sf-button-radius)",
              textDecoration: "none",
              color: "inherit",
              fontSize: "0.92rem",
            }}
          >
            Back to the shop
          </a>
        </div>
      </StorePageShell>
      <StoreFooter page={home} ctx={ctx} />
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 8,
        fontSize: strong ? "1.05rem" : "0.9rem",
        fontWeight: strong ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
