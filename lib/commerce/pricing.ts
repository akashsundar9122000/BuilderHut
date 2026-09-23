/*
 * What the customer pays.
 *
 * Every figure is an integer in minor units. No floats anywhere: a cart that
 * computes 0.1 + 0.2 will eventually charge someone 30.000000000000004 and
 * nobody will be able to explain it.
 *
 * The other rule is that the parts must sum to the whole, exactly. A discount
 * split across lines by naive rounding loses or invents a paisa, and then the
 * order's line totals disagree with its total — which shows up in a merchant's
 * accounts months later as an error nobody can trace. Allocation here uses
 * largest remainder, so the split always sums back to the original.
 */

export interface PriceableLine {
  productId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  /** Physical goods need shipping; a download does not. */
  requiresShipping: boolean;
}

export type DiscountKind = "percent" | "fixed" | "free_shipping";

export interface AppliedDiscount {
  code: string;
  kind: DiscountKind;
  /** Basis points for percent (1000 = 10%), minor units for fixed. */
  value: number;
  minSubtotalMinor?: number | null;
}

export interface ShippingOption {
  id: string;
  name: string;
  kind: "flat" | "free" | "free_over";
  priceMinor: number;
  thresholdMinor?: number | null;
  isPickup: boolean;
}

export interface TaxRule {
  name: string;
  rateBasisPoints: number;
  inclusive: boolean;
}

export interface LineTotals {
  productId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  lineSubtotalMinor: number;
  lineDiscountMinor: number;
  lineTaxMinor: number;
  lineTotalMinor: number;
}

export interface CartTotals {
  lines: LineTotals[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  /** True when the tax is already inside the prices rather than added on. */
  taxInclusive: boolean;
  taxName: string | null;
  discountCode: string | null;
  discountRejected: string | null;
}

/**
 * Split `amount` across `weights` so the parts sum to exactly `amount`.
 *
 * Largest remainder: floor everything, then hand the leftover units to whoever
 * lost the most in rounding. Without this a ₹10 discount across three equal
 * lines becomes three ₹3.33s, and the order is a paisa short of itself.
 */
export function allocate(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0 || amount === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (amount * w) / total);
  const floored = exact.map(Math.floor);
  let remaining = amount - floored.reduce((sum, v) => sum + v, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  const result = [...floored];
  for (let i = 0; remaining > 0 && i < order.length; i++) {
    result[order[i]!.index]! += 1;
    remaining -= 1;
  }
  return result;
}

/** Round half away from zero — what a person expects, unlike Math.round on negatives. */
function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}

function discountAmount(discount: AppliedDiscount, subtotalMinor: number): number {
  switch (discount.kind) {
    case "percent":
      return Math.min(subtotalMinor, roundHalfUp((subtotalMinor * discount.value) / 10000));
    case "fixed":
      // A fixed discount larger than the cart takes the cart to zero, never below.
      return Math.min(subtotalMinor, Math.max(0, discount.value));
    case "free_shipping":
      return 0;
  }
}

function shippingAmount(
  option: ShippingOption | null,
  subtotalAfterDiscountMinor: number,
  freeShipping: boolean,
  needsShipping: boolean,
): number {
  if (!option || option.isPickup || !needsShipping) return 0;
  if (freeShipping) return 0;
  switch (option.kind) {
    case "free":
      return 0;
    case "free_over":
      return option.thresholdMinor != null && subtotalAfterDiscountMinor >= option.thresholdMinor
        ? 0
        : Math.max(0, option.priceMinor);
    case "flat":
      return Math.max(0, option.priceMinor);
  }
}

export function computeTotals({
  lines,
  discount = null,
  shipping = null,
  taxRule = null,
  taxOnShipping = true,
}: {
  lines: PriceableLine[];
  discount?: AppliedDiscount | null;
  shipping?: ShippingOption | null;
  taxRule?: TaxRule | null;
  taxOnShipping?: boolean;
}): CartTotals {
  const lineSubtotals = lines.map((line) =>
    Math.max(0, line.unitPriceMinor) * Math.max(0, line.quantity),
  );
  const subtotalMinor = lineSubtotals.reduce((sum, v) => sum + v, 0);

  /*
   * A discount below its minimum is not silently ignored — the customer typed
   * a code and deserves to be told why it did not apply. Returning the reason
   * is the difference between "this code is broken" and "spend ₹200 more".
   */
  let discountRejected: string | null = null;
  let effective: AppliedDiscount | null = discount;
  if (discount?.minSubtotalMinor != null && subtotalMinor < discount.minSubtotalMinor) {
    effective = null;
    discountRejected = "min_subtotal";
  }

  const discountMinor = effective ? discountAmount(effective, subtotalMinor) : 0;
  const lineDiscounts = allocate(discountMinor, lineSubtotals);

  const subtotalAfterDiscount = subtotalMinor - discountMinor;
  const needsShipping = lines.some((line) => line.requiresShipping && line.quantity > 0);
  const shippingMinor = shippingAmount(
    shipping,
    subtotalAfterDiscount,
    effective?.kind === "free_shipping",
    needsShipping,
  );

  const rate = taxRule?.rateBasisPoints ?? 0;
  const taxable = subtotalAfterDiscount + (taxOnShipping ? shippingMinor : 0);

  /*
   * Inclusive tax is already inside the prices, so it is extracted rather than
   * added: at 18%, a ₹118 price contains ₹18 of tax. Exclusive tax is added on
   * top. Getting this backwards changes what the customer pays by the rate, so
   * it is a merchant setting rather than an assumption.
   */
  const taxMinor =
    rate === 0
      ? 0
      : taxRule!.inclusive
        ? roundHalfUp((taxable * rate) / (10000 + rate))
        : roundHalfUp((taxable * rate) / 10000);

  const totalMinor = taxRule?.inclusive
    ? subtotalAfterDiscount + shippingMinor
    : subtotalAfterDiscount + shippingMinor + taxMinor;

  // Tax is attributed to lines for the invoice. Shipping tax is not a line's.
  const lineTaxableBase = lineSubtotals.map((value, i) => value - lineDiscounts[i]!);
  const taxOnGoods =
    rate === 0
      ? 0
      : taxRule!.inclusive
        ? roundHalfUp((subtotalAfterDiscount * rate) / (10000 + rate))
        : roundHalfUp((subtotalAfterDiscount * rate) / 10000);
  const lineTaxes = allocate(taxOnGoods, lineTaxableBase);

  const resultLines: LineTotals[] = lines.map((line, i) => {
    const lineSubtotal = lineSubtotals[i]!;
    const lineDiscount = lineDiscounts[i]!;
    const lineTax = lineTaxes[i]!;
    return {
      productId: line.productId,
      name: line.name,
      unitPriceMinor: line.unitPriceMinor,
      quantity: line.quantity,
      lineSubtotalMinor: lineSubtotal,
      lineDiscountMinor: lineDiscount,
      lineTaxMinor: lineTax,
      // Inclusive tax is already in the price, so it is not added again here.
      lineTotalMinor: taxRule?.inclusive
        ? lineSubtotal - lineDiscount
        : lineSubtotal - lineDiscount + lineTax,
    };
  });

  return {
    lines: resultLines,
    subtotalMinor,
    discountMinor,
    shippingMinor,
    taxMinor,
    totalMinor,
    taxInclusive: taxRule?.inclusive ?? true,
    taxName: rate > 0 ? (taxRule?.name ?? null) : null,
    discountCode: effective?.code ?? null,
    discountRejected,
  };
}
