import { LABELS, type OrderStatus } from "@/lib/commerce/order-state";

/*
 * Where an order has got to — blueprint section 23.
 *
 * Read off the order's own timestamps, so there is nothing new to store and
 * nothing that can disagree with the order itself. "Being prepared" has no
 * timestamp of its own, so it shows as reached without a date once the order has
 * moved past paid.
 *
 * A cancelled or refunded order ENDS the list rather than continuing to promise
 * steps that are not coming.
 */

export interface TimelineOrder {
  status: string;
  placedAt: Date | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
}

interface Step {
  label: string;
  at: Date | null;
  reached: boolean;
}

const ORDER: OrderStatus[] = [
  "pending_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "delivered",
];

function rank(status: string): number {
  const index = ORDER.indexOf(status as OrderStatus);
  return index === -1 ? 0 : index;
}

export function stepsFor(order: TimelineOrder): Step[] {
  const ended = order.status === "cancelled" || order.status === "refunded";
  if (ended) {
    return [
      { label: "Order placed", at: order.placedAt, reached: true },
      {
        label: order.status === "cancelled" ? "Cancelled" : "Refunded",
        at: order.cancelledAt ?? null,
        reached: true,
      },
    ];
  }

  const reached = rank(order.status);
  return [
    { label: "Order placed", at: order.placedAt, reached: true },
    { label: "Payment confirmed", at: order.paidAt, reached: reached >= rank("paid") },
    { label: "Being prepared", at: null, reached: reached >= rank("processing") },
    { label: "Sent", at: order.shippedAt, reached: reached >= rank("shipped") },
    { label: "Delivered", at: order.deliveredAt, reached: reached >= rank("delivered") },
  ];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function OrderTimeline({ order }: { order: TimelineOrder }) {
  const steps = stepsFor(order);
  // The last reached step is where it has got to, which is what aria-current says.
  const currentIndex = steps.reduce((last, step, index) => (step.reached ? index : last), 0);

  return (
    <ol
      aria-label="Order progress"
      style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 14 }}
    >
      {steps.map((step, index) => {
        const current = index === currentIndex;
        return (
          <li
            key={step.label}
            aria-current={current ? "step" : undefined}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "baseline",
              fontFamily: "var(--sf-font-body)",
              fontSize: "0.9rem",
              // Steps not reached yet are dimmed rather than hidden: knowing what
              // is still to come is most of what this list is for.
              color: step.reached ? "var(--sf-text)" : "var(--sf-muted)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                marginTop: 5,
                borderRadius: 999,
                flexShrink: 0,
                background: step.reached ? "var(--sf-primary)" : "transparent",
                border: step.reached
                  ? "none"
                  : "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              }}
            />
            <span style={{ fontWeight: current ? 600 : 400 }}>{step.label}</span>
            {step.at ? (
              <span style={{ color: "var(--sf-muted)", marginLeft: "auto" }}>
                {formatDate(step.at)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function statusLabel(status: string): string {
  return LABELS[status as OrderStatus] ?? status;
}
