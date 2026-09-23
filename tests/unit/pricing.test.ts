import { describe, expect, it } from "vitest";
import {
  allocate,
  computeTotals,
  type PriceableLine,
  type ShippingOption,
} from "@/lib/commerce/pricing";

const line = (price: number, qty = 1, requiresShipping = true): PriceableLine => ({
  productId: `p${price}-${qty}`,
  name: `Item ${price}`,
  unitPriceMinor: price,
  quantity: qty,
  requiresShipping,
});

const flat = (priceMinor: number): ShippingOption => ({
  id: "s1",
  name: "Standard",
  kind: "flat",
  priceMinor,
  isPickup: false,
});

const GST18 = { name: "GST 18%", rateBasisPoints: 1800, inclusive: true };
const SALES8 = { name: "Sales tax", rateBasisPoints: 800, inclusive: false };

describe("allocate", () => {
  /*
   * The property that matters: the parts sum to the whole. Naive rounding loses
   * or invents units, and then an order's lines disagree with its total.
   */
  it("always sums back to the amount", () => {
    for (const [amount, weights] of [
      [1000, [1, 1, 1]],
      [1, [1, 1, 1]],
      [999, [500, 300, 199]],
      [7, [1, 2, 3, 4, 5]],
      [123456, [17, 41, 3]],
    ] as [number, number[]][]) {
      const parts = allocate(amount, weights);
      expect(parts.reduce((a, b) => a + b, 0), `${amount} / ${weights}`).toBe(amount);
    }
  });

  it("gives leftover units to the largest remainders", () => {
    // 10 across three equal parts: 4, 3, 3 — never 3, 3, 3.
    expect(allocate(10, [1, 1, 1]).sort((a, b) => b - a)).toEqual([4, 3, 3]);
  });

  it("handles zero weights and zero amounts", () => {
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });
});

describe("subtotals", () => {
  it("multiplies price by quantity", () => {
    const totals = computeTotals({ lines: [line(49900, 2), line(12000, 1)] });
    expect(totals.subtotalMinor).toBe(49900 * 2 + 12000);
    expect(totals.totalMinor).toBe(111800);
  });

  it("treats an empty cart as zero, not as an error", () => {
    const totals = computeTotals({ lines: [] });
    expect(totals.subtotalMinor).toBe(0);
    expect(totals.totalMinor).toBe(0);
  });
});

describe("discounts", () => {
  it("applies a percentage", () => {
    const totals = computeTotals({
      lines: [line(100000)],
      discount: { code: "TEN", kind: "percent", value: 1000 },
    });
    expect(totals.discountMinor).toBe(10000);
    expect(totals.totalMinor).toBe(90000);
  });

  it("applies a fixed amount", () => {
    const totals = computeTotals({
      lines: [line(100000)],
      discount: { code: "FLAT", kind: "fixed", value: 25000 },
    });
    expect(totals.discountMinor).toBe(25000);
  });

  it("never discounts below zero", () => {
    // A ₹500 voucher against a ₹100 cart is free, not a ₹400 refund.
    const totals = computeTotals({
      lines: [line(10000)],
      discount: { code: "BIG", kind: "fixed", value: 50000 },
    });
    expect(totals.discountMinor).toBe(10000);
    expect(totals.totalMinor).toBe(0);
  });

  it("splits a discount across lines so the parts sum to the whole", () => {
    const totals = computeTotals({
      lines: [line(33300), line(33300), line(33400)],
      discount: { code: "TEN", kind: "percent", value: 1000 },
    });
    const summed = totals.lines.reduce((sum, l) => sum + l.lineDiscountMinor, 0);
    expect(summed).toBe(totals.discountMinor);
  });

  it("rejects a code below its minimum and says why", () => {
    const totals = computeTotals({
      lines: [line(10000)],
      discount: { code: "OVER200", kind: "fixed", value: 5000, minSubtotalMinor: 20000 },
    });
    expect(totals.discountMinor).toBe(0);
    expect(totals.discountCode).toBeNull();
    // The customer typed a code; they deserve to know it needs a bigger basket.
    expect(totals.discountRejected).toBe("min_subtotal");
  });

  it("accepts a code exactly at its minimum", () => {
    const totals = computeTotals({
      lines: [line(20000)],
      discount: { code: "OVER200", kind: "fixed", value: 5000, minSubtotalMinor: 20000 },
    });
    expect(totals.discountMinor).toBe(5000);
  });
});

describe("shipping", () => {
  it("adds a flat rate", () => {
    const totals = computeTotals({ lines: [line(50000)], shipping: flat(8000) });
    expect(totals.shippingMinor).toBe(8000);
    expect(totals.totalMinor).toBe(58000);
  });

  it("charges nothing for collection", () => {
    const totals = computeTotals({
      lines: [line(50000)],
      shipping: { id: "p", name: "Collect", kind: "flat", priceMinor: 8000, isPickup: true },
    });
    expect(totals.shippingMinor).toBe(0);
  });

  it("charges nothing when no line needs shipping", () => {
    // A cart of downloads has nothing to post.
    const totals = computeTotals({
      lines: [line(50000, 1, false)],
      shipping: flat(8000),
    });
    expect(totals.shippingMinor).toBe(0);
  });

  it("waives the charge above the free-shipping threshold", () => {
    const option: ShippingOption = {
      id: "s",
      name: "Standard",
      kind: "free_over",
      priceMinor: 8000,
      thresholdMinor: 150000,
      isPickup: false,
    };
    expect(computeTotals({ lines: [line(149900)], shipping: option }).shippingMinor).toBe(8000);
    expect(computeTotals({ lines: [line(150000)], shipping: option }).shippingMinor).toBe(0);
  });

  it("measures the free-shipping threshold AFTER the discount", () => {
    /*
     * A ₹1,600 cart with ₹200 off is a ₹1,400 sale. Measuring the threshold
     * before the discount would give free shipping on an order that did not
     * earn it — a small leak that repeats on every order.
     */
    const option: ShippingOption = {
      id: "s", name: "Standard", kind: "free_over",
      priceMinor: 8000, thresholdMinor: 150000, isPickup: false,
    };
    const totals = computeTotals({
      lines: [line(160000)],
      discount: { code: "TWO", kind: "fixed", value: 20000 },
      shipping: option,
    });
    expect(totals.shippingMinor).toBe(8000);
  });

  it("a free-shipping code waives the charge", () => {
    const totals = computeTotals({
      lines: [line(50000)],
      discount: { code: "FREESHIP", kind: "free_shipping", value: 0 },
      shipping: flat(8000),
    });
    expect(totals.shippingMinor).toBe(0);
    expect(totals.discountMinor).toBe(0);
    expect(totals.totalMinor).toBe(50000);
  });
});

describe("tax", () => {
  it("extracts inclusive tax from the price rather than adding it", () => {
    // ₹1,180 at 18% inclusive contains ₹180 of tax; the customer pays ₹1,180.
    const totals = computeTotals({ lines: [line(118000)], taxRule: GST18 });
    expect(totals.taxMinor).toBe(18000);
    expect(totals.totalMinor).toBe(118000);
    expect(totals.taxInclusive).toBe(true);
  });

  it("adds exclusive tax on top", () => {
    const totals = computeTotals({ lines: [line(100000)], taxRule: SALES8 });
    expect(totals.taxMinor).toBe(8000);
    expect(totals.totalMinor).toBe(108000);
  });

  it("taxes the discounted amount, not the list price", () => {
    const totals = computeTotals({
      lines: [line(100000)],
      discount: { code: "TEN", kind: "percent", value: 1000 },
      taxRule: SALES8,
    });
    // 8% of 90,000, not of 100,000.
    expect(totals.taxMinor).toBe(7200);
    expect(totals.totalMinor).toBe(97200);
  });

  it("includes shipping in the taxable amount when asked to", () => {
    const withTax = computeTotals({
      lines: [line(100000)], shipping: flat(10000), taxRule: SALES8, taxOnShipping: true,
    });
    const without = computeTotals({
      lines: [line(100000)], shipping: flat(10000), taxRule: SALES8, taxOnShipping: false,
    });
    expect(withTax.taxMinor).toBe(8800);
    expect(without.taxMinor).toBe(8000);
  });

  it("is zero when no rule applies", () => {
    const totals = computeTotals({ lines: [line(100000)] });
    expect(totals.taxMinor).toBe(0);
    expect(totals.taxName).toBeNull();
  });

  it("splits line tax so it sums to the tax on goods", () => {
    const totals = computeTotals({
      lines: [line(33333), line(33333), line(33334)],
      taxRule: SALES8,
    });
    const summed = totals.lines.reduce((sum, l) => sum + l.lineTaxMinor, 0);
    // The order-level figure also covers shipping; with none, they must match.
    expect(summed).toBe(totals.taxMinor);
  });
});

describe("the whole invoice adds up", () => {
  it("total equals subtotal minus discount plus shipping plus exclusive tax", () => {
    const totals = computeTotals({
      lines: [line(49900, 2), line(120000)],
      discount: { code: "TEN", kind: "percent", value: 1000 },
      shipping: flat(9900),
      taxRule: SALES8,
    });
    expect(totals.totalMinor).toBe(
      totals.subtotalMinor - totals.discountMinor + totals.shippingMinor + totals.taxMinor,
    );
  });

  it("with inclusive tax the total excludes the tax, which is already inside", () => {
    const totals = computeTotals({
      lines: [line(118000)],
      shipping: flat(10000),
      taxRule: GST18,
    });
    expect(totals.totalMinor).toBe(totals.subtotalMinor + totals.shippingMinor);
    expect(totals.taxMinor).toBeGreaterThan(0);
  });

  it("line totals sum to the order total, inclusive case", () => {
    const totals = computeTotals({
      lines: [line(33300), line(66700, 2)],
      discount: { code: "TEN", kind: "percent", value: 1000 },
      taxRule: GST18,
    });
    const linesSum = totals.lines.reduce((sum, l) => sum + l.lineTotalMinor, 0);
    expect(linesSum).toBe(totals.totalMinor - totals.shippingMinor);
  });

  it("never produces a fractional or negative figure", () => {
    const totals = computeTotals({
      lines: [line(1, 3), line(7, 1)],
      discount: { code: "NINETY", kind: "percent", value: 9000 },
      shipping: flat(1),
      taxRule: SALES8,
    });
    for (const [key, value] of Object.entries(totals)) {
      if (typeof value === "number") {
        expect(Number.isInteger(value), `${key} = ${value}`).toBe(true);
        expect(value, `${key} = ${value}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
