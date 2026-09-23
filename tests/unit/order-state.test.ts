import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  countsAsRevenue,
  nextStatuses,
  ORDER_STATUSES,
  OrderTransitionError,
  reservesStock,
  type OrderStatus,
} from "@/lib/commerce/order-state";

describe("the order machine", () => {
  it("describes a transition for every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(() => nextStatuses(status), status).not.toThrow();
    }
  });

  it("walks the ordinary path from payment to delivery", () => {
    const path: OrderStatus[] = ["pending_payment", "paid", "processing", "packed", "shipped", "delivered"];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  /*
   * The transitions that matter are the ones this REFUSES. Each of these is a
   * mistake a merchant could make by clicking the wrong button, and recording
   * it would corrupt the order's meaning rather than merely annoy someone.
   */
  it("refuses to fulfil an order that has not been paid for", () => {
    expect(canTransition("pending_payment", "processing")).toBe(false);
    expect(canTransition("pending_payment", "shipped")).toBe(false);
    expect(canTransition("pending_payment", "delivered")).toBe(false);
  });

  it("refuses to refund an order that was never paid", () => {
    expect(canTransition("pending_payment", "refunded")).toBe(false);
  });

  it("refuses to revive a cancelled or refunded order", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("cancelled", to), `cancelled → ${to}`).toBe(false);
      expect(canTransition("refunded", to), `refunded → ${to}`).toBe(false);
    }
  });

  it("refuses to cancel an order already with the courier", () => {
    // The recourse once it is posted is a refund, not a cancellation.
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("shipped", "refunded")).toBe(true);
  });

  it("refuses to walk backwards", () => {
    expect(canTransition("shipped", "packed")).toBe(false);
    expect(canTransition("delivered", "shipped")).toBe(false);
    expect(canTransition("paid", "pending_payment")).toBe(false);
  });

  it("allows a partial refund to become a full one, but not the reverse", () => {
    expect(canTransition("partially_refunded", "refunded")).toBe(true);
    expect(canTransition("refunded", "partially_refunded")).toBe(false);
  });

  it("throws with a sentence a merchant can read", () => {
    try {
      assertTransition("pending_payment", "shipped");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(OrderTransitionError);
      expect((error as Error).message).toBe("An order that is awaiting payment cannot become sent.");
    }
  });

  it("never allows a status to transition to itself", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status), status).toBe(false);
    }
  });
});

describe("what counts", () => {
  it("excludes unpaid, cancelled and refunded orders from revenue", () => {
    expect(countsAsRevenue("pending_payment")).toBe(false);
    expect(countsAsRevenue("cancelled")).toBe(false);
    expect(countsAsRevenue("refunded")).toBe(false);
    expect(countsAsRevenue("paid")).toBe(true);
    expect(countsAsRevenue("delivered")).toBe(true);
    // A partial refund still represents a real sale, net of what went back.
    expect(countsAsRevenue("partially_refunded")).toBe(true);
  });

  it("returns stock when an order is cancelled or refunded", () => {
    expect(reservesStock("cancelled")).toBe(false);
    expect(reservesStock("refunded")).toBe(false);
    expect(reservesStock("paid")).toBe(true);
  });
});
