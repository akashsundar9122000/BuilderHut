/*
 * Money is integer minor units plus a currency, never a float.
 *
 * 0.1 + 0.2 is 0.30000000000000004, and a store that computes a cart total that
 * way will eventually charge someone the wrong amount and have no way to
 * explain it. Blueprint section 103 forbids it outright.
 */

/** How many minor units make one major unit. Most currencies are 100. */
const EXPONENT: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
};

export function exponentOf(currency: string): number {
  return EXPONENT[currency.toUpperCase()] ?? 2;
}

/**
 * Format for display. Uses Intl, so ₹1,24,500 comes out with Indian digit
 * grouping rather than the western thousands grouping — which a merchant in
 * Chennai will notice immediately.
 */
export function formatMoney(
  minor: bigint | number,
  currency: string,
  locale = "en-IN",
): string {
  const exp = exponentOf(currency);
  const value = Number(minor) / 10 ** exp;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(value);
  } catch {
    // An unknown currency code should still render a number, not throw.
    return `${currency.toUpperCase()} ${value.toFixed(exp)}`;
  }
}

/** "1499.50" or "1499" from a form field, to minor units. Rejects anything else. */
export function parseMoney(input: string, currency: string): number | null {
  const trimmed = input.trim().replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const exp = exponentOf(currency);
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > exp) return null;
  const padded = fraction.padEnd(exp, "0");
  const minor = Number(`${whole}${padded}`);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function discountPercent(
  priceMinor: bigint | number,
  compareAtMinor: bigint | number | null | undefined,
): number | null {
  if (compareAtMinor == null) return null;
  const price = Number(priceMinor);
  const was = Number(compareAtMinor);
  if (was <= price || was <= 0) return null;
  return Math.round(((was - price) / was) * 100);
}
