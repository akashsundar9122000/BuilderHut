import "server-only";

import { asc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { runForTenant } from "@/lib/auth/session";
import {
  discounts,
  shippingMethods,
  shippingZones,
  storeSettings,
  taxRules,
  tenants,
} from "@/lib/db/schema";
import { parseMoney } from "@/lib/money";
import { EntitlementError, requireFeature } from "@/lib/plans/entitlements";
import { getRootDb } from "@/lib/db/client";

/*
 * The merchant's commerce configuration.
 *
 * Discount codes, delivery options and tax rules — the three things the pricing
 * engine reads and that nothing else should be allowed to hard-code. Blueprint
 * section 13 in particular: a jurisdiction's tax rate is configuration, not an
 * assumption baked into the code.
 */

export type SaveResult = { ok: true } | { ok: false; field?: string; message: string };

/* ── Discounts ───────────────────────────────────────────────────────────── */

export async function listDiscounts() {
  return runForTenant((db) => db.select(discounts).orderBy(asc(discounts.code)).limit(200));
}

export async function createDiscount(input: {
  code: string;
  kind: "percent" | "fixed" | "free_shipping";
  amount: string;
  minSubtotal: string;
  maxRedemptions: string;
  currency: string;
}): Promise<SaveResult> {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) {
    return {
      ok: false,
      field: "code",
      message: "Use 3–40 letters, numbers and hyphens. People type these by hand.",
    };
  }

  let value = 0n;
  if (input.kind === "percent") {
    const percent = Number(input.amount);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      return { ok: false, field: "amount", message: "Enter a percentage between 1 and 100." };
    }
    // Basis points, so 12.5% is exactly 1250 rather than a float.
    value = BigInt(Math.round(percent * 100));
  } else if (input.kind === "fixed") {
    const minor = parseMoney(input.amount, input.currency);
    if (minor === null || minor <= 0) {
      return { ok: false, field: "amount", message: "Enter an amount like 250." };
    }
    value = BigInt(minor);
  }

  let minSubtotal: bigint | null = null;
  if (input.minSubtotal.trim()) {
    const minor = parseMoney(input.minSubtotal, input.currency);
    if (minor === null) {
      return { ok: false, field: "minSubtotal", message: "Enter an amount, or leave it blank." };
    }
    minSubtotal = BigInt(minor);
  }

  let maxRedemptions: number | null = null;
  if (input.maxRedemptions.trim()) {
    const n = Number(input.maxRedemptions);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, field: "maxRedemptions", message: "Enter a whole number, or leave it blank." };
    }
    maxRedemptions = n;
  }

  try {
    await runForTenant((db) =>
      db.insert(discounts, {
        id: uuidv7(),
        code,
        kind: input.kind,
        value,
        minSubtotalMinor: minSubtotal,
        maxRedemptions,
      }),
    );
    return { ok: true };
  } catch (error) {
    if (/discounts_tenant_code_key|duplicate key/i.test(String(error))) {
      return { ok: false, field: "code", message: "You already have a code with that name." };
    }
    console.error("[createDiscount]", error);
    return { ok: false, message: "We couldn't save that code." };
  }
}

export async function toggleDiscount(id: string, active: boolean): Promise<SaveResult> {
  const rows = await runForTenant((db) => db.update(discounts, { active }, eq(discounts.id, id)));
  return rows.length > 0 ? { ok: true } : { ok: false, message: "That code no longer exists." };
}

/* ── Delivery ────────────────────────────────────────────────────────────── */

export async function listShipping() {
  return runForTenant(async (db) => ({
    zones: await db.select(shippingZones).orderBy(asc(shippingZones.position)),
    methods: await db.select(shippingMethods).orderBy(asc(shippingMethods.position)),
  }));
}

export async function createShippingMethod(input: {
  zoneId: string;
  name: string;
  description: string;
  kind: "flat" | "free" | "free_over";
  price: string;
  threshold: string;
  isPickup: boolean;
  currency: string;
}): Promise<SaveResult> {
  if (input.name.trim().length < 2) {
    return { ok: false, field: "name", message: "Give it a name customers will understand." };
  }

  let priceMinor = 0n;
  if (input.kind === "flat" || input.kind === "free_over") {
    const minor = parseMoney(input.price || "0", input.currency);
    if (minor === null) return { ok: false, field: "price", message: "Enter an amount like 80." };
    priceMinor = BigInt(minor);
  }

  let threshold: bigint | null = null;
  if (input.kind === "free_over") {
    const minor = parseMoney(input.threshold, input.currency);
    if (minor === null || minor <= 0) {
      return {
        ok: false,
        field: "threshold",
        message: "Enter the basket total above which delivery is free.",
      };
    }
    threshold = BigInt(minor);
  }

  await runForTenant((db) =>
    db.insert(shippingMethods, {
      id: uuidv7(),
      zoneId: input.zoneId,
      name: input.name.trim(),
      description: input.description.trim() || null,
      kind: input.kind,
      priceMinor,
      thresholdMinor: threshold,
      isPickup: input.isPickup,
      position: 99,
    }),
  );
  return { ok: true };
}

export async function toggleShippingMethod(id: string, active: boolean): Promise<SaveResult> {
  const rows = await runForTenant((db) =>
    db.update(shippingMethods, { active }, eq(shippingMethods.id, id)),
  );
  return rows.length > 0 ? { ok: true } : { ok: false, message: "That option no longer exists." };
}

/* ── Tax ─────────────────────────────────────────────────────────────────── */

export async function listTaxRules() {
  return runForTenant((db) => db.select(taxRules).orderBy(asc(taxRules.position)));
}

export async function createTaxRule(input: {
  name: string;
  rate: string;
  inclusive: boolean;
}): Promise<SaveResult> {
  if (input.name.trim().length < 2) {
    return {
      ok: false,
      field: "name",
      message: "Name it as it should appear on an invoice — 'GST 18%', 'VAT'.",
    };
  }
  const rate = Number(input.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { ok: false, field: "rate", message: "Enter a percentage between 0 and 100." };
  }

  await runForTenant(async (db) => {
    /*
     * One active rule at a time. The pricing engine applies the first active
     * rule, so two would mean the total depending on which came back first —
     * and a merchant would have no way to see why. Compound and regional rules
     * are a real requirement later; silently picking one is not.
     */
    const existing = await db.select(taxRules);
    for (const rule of existing) {
      if (rule.active) await db.update(taxRules, { active: false }, eq(taxRules.id, rule.id));
    }
    await db.insert(taxRules, {
      id: uuidv7(),
      name: input.name.trim(),
      // Basis points: 18% is 1800, and 12.5% is 1250 rather than a float.
      rateBasisPoints: Math.round(rate * 100),
      inclusive: input.inclusive,
      active: true,
    });
  });
  return { ok: true };
}

export async function setTaxRuleActive(id: string, active: boolean): Promise<SaveResult> {
  await runForTenant(async (db) => {
    if (active) {
      const existing = await db.select(taxRules);
      for (const rule of existing) {
        if (rule.active) await db.update(taxRules, { active: false }, eq(taxRules.id, rule.id));
      }
    }
    await db.update(taxRules, { active }, eq(taxRules.id, id));
  });
  return { ok: true };
}

/* ── Store settings ──────────────────────────────────────────────────────── */

export async function loadStoreSettings(tenantId: string) {
  return runForTenant(async (db) => {
    const [settings] = await db.select(storeSettings).limit(1);
    const [tenant] = await getRootDb()
      .select({
        name: tenants.name,
        slug: tenants.slug,
        currency: tenants.currency,
        country: tenants.country,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    return { settings: settings ?? null, tenant: tenant ?? null };
  });
}

export async function saveStoreSettings(input: {
  checkoutMode: "guest" | "optional_account" | "account_required";
  requirePhone: boolean;
  allowOrderNotes: boolean;
  showMarketingConsent: boolean;
  gstin: string;
}): Promise<SaveResult> {
  const gstin = input.gstin.trim().toUpperCase();
  /*
   * GSTIN has a defined shape: 2 state digits, a 10-character PAN, an entity
   * digit, Z, and a checksum character. Validating the FORMAT is useful — a
   * typo on an invoice is a real problem — but this deliberately does not
   * verify the checksum or claim the number is registered. Blueprint section 13
   * asks for jurisdiction rules to be independently verified before being
   * relied upon, and this is not that.
   */
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    return { ok: false, field: "gstin", message: "That doesn't look like a GSTIN. Leave it blank if unsure." };
  }

  await runForTenant(async (db) => {
    const [existing] = await db.select(storeSettings).limit(1);
    const values = {
      checkoutMode: input.checkoutMode,
      requirePhone: input.requirePhone,
      allowOrderNotes: input.allowOrderNotes,
      showMarketingConsent: input.showMarketingConsent,
      gstin: gstin || null,
    };
    if (existing) {
      await db.update(storeSettings, values, eq(storeSettings.id, existing.id));
    } else {
      await db.insert(storeSettings, { id: uuidv7(), ...values });
    }
  });
  return { ok: true };
}

/*
 * How this store signs its customers in.
 *
 * Three separate decisions, because merchants genuinely differ: a bakery taking
 * orders over WhatsApp wants a mobile number and a code, and a seller of digital
 * downloads needs an email address to deliver to and nothing else.
 *
 * The cross-field rules below exist because two of these settings can be
 * combined into a shop nobody can get into, and the merchant would only find out
 * from a customer. Each refusal is a sentence they can act on.
 */
export async function saveCustomerAccountSettings(input: {
  identifier: "email_only" | "phone_only" | "either" | "both";
  credential: "password" | "code" | "both";
  verification: "at_signup" | "before_checkout" | "off";
}): Promise<SaveResult> {
  const wantsPhone = input.identifier !== "email_only";

  return runForTenant(async (db) => {
    const [existing] = await db.select(storeSettings).limit(1);

    if (wantsPhone) {
      /*
       * The plan gate, enforced where the write happens rather than by greying
       * out an option. lib/plans/entitlements.ts makes the argument: a limit
       * enforced only by hiding a control is not a limit.
       */
      try {
        await requireFeature(db.ctx.tenantId, "customerPhoneAuth");
      } catch (error) {
        if (error instanceof EntitlementError) {
          return { ok: false as const, field: "identifier", message: error.message };
        }
        throw error;
      }
    }

    if (input.credential === "code" && input.verification === "off") {
      return {
        ok: false as const,
        field: "verification",
        message:
          "A one-time code IS the confirmation. Either allow passwords too, or leave confirming on.",
      };
    }

    if (input.identifier === "phone_only" && input.credential === "password") {
      return {
        ok: false as const,
        field: "credential",
        message:
          "A password and no email address means nobody can reset one. Allow codes as well, or ask for an email too.",
      };
    }

    const mode = existing?.checkoutMode ?? "guest";
    if (mode === "account_required" && input.identifier === "phone_only" && !wantsPhone) {
      // Unreachable while wantsPhone is derived from identifier; kept as the
      // explicit statement of the rule readiness also checks.
      return { ok: false as const, field: "identifier", message: "Nobody would be able to check out." };
    }

    const values = {
      customerIdentifier: input.identifier,
      customerCredential: input.credential,
      customerVerification: input.verification,
    };
    if (existing) {
      await db.update(storeSettings, values, eq(storeSettings.id, existing.id));
    } else {
      await db.insert(storeSettings, { id: uuidv7(), ...values });
    }
    return { ok: true as const };
  });
}
