/*
 * The order lifecycle, as a machine with explicit edges.
 *
 * Blueprint section 75. The point is not bureaucracy: it is that "mark as
 * shipped" on an order that was never paid, or a refund on an order that was
 * cancelled, are mistakes the database should refuse rather than record. And
 * the browser can ask for any transition it likes — only this table decides.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Who is allowed to move an order, and where to. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Payment is the gate. Nothing reaches fulfilment without passing it.
  pending_payment: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded", "partially_refunded"],
  processing: ["packed", "shipped", "cancelled", "refunded", "partially_refunded"],
  packed: ["shipped", "cancelled", "refunded", "partially_refunded"],
  // Once it is with the courier, cancelling is not a thing a merchant can do
  // unilaterally — the recourse is a refund.
  shipped: ["delivered", "refunded", "partially_refunded"],
  delivered: ["refunded", "partially_refunded"],
  partially_refunded: ["refunded"],
  // Terminal.
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from];
}

export class OrderTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`An order that is ${LABELS[from].toLowerCase()} cannot become ${LABELS[to].toLowerCase()}.`);
    this.name = "OrderTransitionError";
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new OrderTransitionError(from, to);
}

/** Wording a merchant would use, not the enum. */
export const LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Being prepared",
  packed: "Packed",
  shipped: "Sent",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
};

/** Maps onto the design system's badge tones. */
export const TONES: Record<OrderStatus, "neutral" | "accent" | "success" | "warning" | "danger" | "info"> = {
  pending_payment: "warning",
  paid: "success",
  processing: "info",
  packed: "info",
  shipped: "accent",
  delivered: "success",
  cancelled: "neutral",
  refunded: "danger",
  partially_refunded: "warning",
};

/** Statuses that count towards a merchant's revenue. */
export function countsAsRevenue(status: OrderStatus): boolean {
  return !["pending_payment", "cancelled", "refunded"].includes(status);
}

/** Statuses where stock has left the shelf and should be deducted. */
export function reservesStock(status: OrderStatus): boolean {
  return !["pending_payment", "cancelled", "refunded"].includes(status);
}
