import "server-only";

import { eq } from "drizzle-orm";

import type { TenantDb } from "@/lib/db/tenant";
import { discounts } from "@/lib/db/schema";
import type { AppliedDiscount } from "./pricing";

/*
 * Resolving a code to a discount the pricing engine can apply.
 *
 * Every rule is re-checked at the moment it is used, never cached with the
 * cart. A code that expires, is switched off, or runs out of redemptions
 * between being entered and being paid for must stop applying — otherwise a
 * merchant's "first 50 customers" promotion honours the five hundredth.
 */

export type DiscountLookup =
  | { ok: true; discount: AppliedDiscount }
  | { ok: false; reason: string };

export async function lookupDiscount(db: TenantDb, code: string): Promise<DiscountLookup> {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return { ok: false, reason: "Enter a code." };

  const [row] = await db.select(discounts).where(eq(discounts.code, normalised)).limit(1);

  // One message for "no such code" and "switched off". Telling them apart
  // invites someone to probe for which codes exist.
  if (!row || !row.active) return { ok: false, reason: "That code isn't valid." };

  const now = new Date();
  if (row.startsAt && row.startsAt > now) return { ok: false, reason: "That code isn't active yet." };
  if (row.endsAt && row.endsAt < now) return { ok: false, reason: "That code has expired." };
  if (row.maxRedemptions !== null && row.redemptions >= row.maxRedemptions) {
    return { ok: false, reason: "That code has been fully used." };
  }

  return {
    ok: true,
    discount: {
      code: row.code,
      kind: row.kind,
      value: Number(row.value),
      minSubtotalMinor: row.minSubtotalMinor === null ? null : Number(row.minSubtotalMinor),
    },
  };
}
