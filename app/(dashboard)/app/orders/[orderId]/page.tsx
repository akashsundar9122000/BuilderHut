import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";

import { OrderActions, RefundForm } from "@/components/dashboard/OrderActions";
import { Badge, Card, CardBody } from "@/components/ui";
import { runForTenant } from "@/lib/auth/session";
import { orderAddresses, orderItems, orders, payments, refunds } from "@/lib/db/schema";
import { LABELS, nextStatuses, TONES, type OrderStatus } from "@/lib/commerce/order-state";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const data = await runForTenant(async (db) => {
    const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return null;
    return {
      order,
      items: await db.select(orderItems).where(eq(orderItems.orderId, orderId)),
      address: (
        await db.select(orderAddresses).where(eq(orderAddresses.orderId, orderId)).limit(1)
      )[0],
      payments: await db.select(payments).where(eq(payments.orderId, orderId)),
      refunds: await db.select(refunds).where(eq(refunds.orderId, orderId)),
    };
  });

  // Zero rows means the id belongs to another store, or to nothing. Both are
  // "not found" as far as this merchant is concerned.
  if (!data) notFound();
  const { order, items, address } = data;
  const status = order.status as OrderStatus;
  const remaining = Number(order.totalMinor) - Number(order.refundedMinor);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/app/orders"
        className="text-muted hover:text-text mb-5 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Orders
      </Link>

      <header className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-3xl leading-tight">Order #{order.number}</h1>
        <Badge tone={TONES[status]}>{LABELS[status]}</Badge>
        <span className="text-muted text-sm">
          {new Date(order.createdAt).toLocaleString()}
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardBody>
              <h2 className="font-display mb-4 text-lg">What they bought</h2>
              <ul className="divide-border divide-y">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-text truncate text-sm">{item.productName}</p>
                      <p className="text-muted text-xs">
                        {formatMoney(item.unitPriceMinor, item.currency)} × {item.quantity}
                        {item.sku ? ` · ${item.sku}` : ""}
                      </p>
                    </div>
                    <span className="text-text text-sm tabular-nums">
                      {formatMoney(item.lineTotalMinor, item.currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="border-border mt-4 border-t pt-4 text-sm">
                <Row label="Subtotal" value={formatMoney(order.subtotalMinor, order.currency)} />
                {Number(order.discountMinor) > 0 ? (
                  <Row
                    label={`Discount${order.discountCode ? ` (${order.discountCode})` : ""}`}
                    value={`−${formatMoney(order.discountMinor, order.currency)}`}
                  />
                ) : null}
                <Row
                  label={order.shippingMethodName ?? "Delivery"}
                  value={
                    Number(order.shippingMinor) === 0
                      ? "Free"
                      : formatMoney(order.shippingMinor, order.currency)
                  }
                />
                {Number(order.taxMinor) > 0 ? (
                  <Row label="Tax" value={formatMoney(order.taxMinor, order.currency)} />
                ) : null}
                <Row label="Total" value={formatMoney(order.totalMinor, order.currency)} strong />
                {Number(order.refundedMinor) > 0 ? (
                  <Row
                    label="Refunded"
                    value={`−${formatMoney(order.refundedMinor, order.currency)}`}
                  />
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {order.customerNote ? (
            <Card>
              <CardBody>
                <h2 className="font-display mb-2 text-lg">Their note</h2>
                <p className="text-text-secondary text-sm leading-relaxed">{order.customerNote}</p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody>
              <h2 className="font-display mb-3 text-lg">Payment</h2>
              {data.payments.length === 0 ? (
                <p className="text-muted text-sm">Nothing recorded yet.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {data.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-text">{formatMoney(payment.amountMinor, payment.currency)}</span>
                      <Badge tone={payment.status === "succeeded" ? "success" : "warning"}>
                        {payment.status}
                      </Badge>
                      <span className="text-muted font-mono text-xs">{payment.providerRef}</span>
                      {payment.failureReason ? (
                        <span className="text-danger w-full text-xs">{payment.failureReason}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-faint mt-3 text-xs">
                Simulated payments — no money has moved.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardBody>
              <h2 className="font-display mb-3 text-lg">Next step</h2>
              <OrderActions orderId={order.id} next={nextStatuses(status)} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="font-display mb-3 text-lg">Customer</h2>
              <p className="text-text text-sm break-all">{order.email}</p>
              {order.phone ? <p className="text-muted mt-1 text-sm">{order.phone}</p> : null}
              {address ? (
                <p className="text-text-secondary mt-3 text-sm leading-relaxed">
                  {address.name}
                  <br />
                  {address.line1}
                  {address.line2 ? (
                    <>
                      <br />
                      {address.line2}
                    </>
                  ) : null}
                  <br />
                  {[address.city, address.region, address.postalCode].filter(Boolean).join(", ")}
                  <br />
                  {address.country}
                </p>
              ) : (
                <p className="text-muted mt-3 text-sm">
                  {order.fulfilment === "pickup" ? "Collecting in person." : "No address needed."}
                </p>
              )}
            </CardBody>
          </Card>

          {remaining > 0 && ["paid", "processing", "packed", "shipped", "delivered", "partially_refunded"].includes(status) ? (
            <Card>
              <CardBody>
                <h2 className="font-display mb-3 text-lg">Refund</h2>
                <RefundForm
                  orderId={order.id}
                  currency={order.currency}
                  remainingLabel={formatMoney(remaining, order.currency)}
                />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <dt className={strong ? "text-text font-medium" : "text-muted"}>{label}</dt>
      <dd className={strong ? "text-text font-medium tabular-nums" : "text-text tabular-nums"}>
        {value}
      </dd>
    </div>
  );
}
