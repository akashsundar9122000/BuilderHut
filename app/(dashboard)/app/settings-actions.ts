"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireActor } from "@/lib/auth/session";
import { getRootDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import {
  createDiscount,
  createShippingMethod,
  createTaxRule,
  saveCustomerAccountSettings,
  saveStoreSettings,
  setTaxRuleActive,
  toggleDiscount,
  toggleShippingMethod,
} from "@/lib/commerce/settings";

/*
 * Server actions for the commerce settings screens.
 *
 * The store's currency is read from the tenant rather than taken from the form.
 * A price submitted alongside a currency the browser chose is a pricing bug
 * waiting to bill somebody in the wrong denomination.
 */

export type SettingsState = { error?: string; field?: string; ok?: boolean };

async function currencyOf(tenantId: string): Promise<string> {
  const rows = await getRootDb()
    .select({ currency: tenants.currency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0]?.currency ?? "INR";
}

const flag = (form: FormData, name: string) => form.get(name) === "on";

export async function createDiscountAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireActor();
  if (!actor.tenantId) return { error: "You don't have a store." };

  const kind = String(formData.get("kind") ?? "percent");
  const result = await createDiscount({
    code: String(formData.get("code") ?? ""),
    kind: kind === "fixed" || kind === "free_shipping" ? kind : "percent",
    amount: String(formData.get("amount") ?? ""),
    minSubtotal: String(formData.get("minSubtotal") ?? ""),
    maxRedemptions: String(formData.get("maxRedemptions") ?? ""),
    currency: await currencyOf(actor.tenantId),
  });

  if (!result.ok) return { error: result.message, field: result.field };
  revalidatePath("/app/discounts");
  return { ok: true };
}

export async function toggleDiscountAction(formData: FormData): Promise<void> {
  await requireActor();
  await toggleDiscount(String(formData.get("id") ?? ""), formData.get("active") === "true");
  revalidatePath("/app/discounts");
}

export async function createShippingAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireActor();
  if (!actor.tenantId) return { error: "You don't have a store." };

  const kind = String(formData.get("kind") ?? "flat");
  const result = await createShippingMethod({
    zoneId: String(formData.get("zoneId") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    kind: kind === "free" || kind === "free_over" ? kind : "flat",
    price: String(formData.get("price") ?? "0"),
    threshold: String(formData.get("threshold") ?? ""),
    isPickup: flag(formData, "isPickup"),
    currency: await currencyOf(actor.tenantId),
  });

  if (!result.ok) return { error: result.message, field: result.field };
  revalidatePath("/app/shipping");
  return { ok: true };
}

export async function toggleShippingAction(formData: FormData): Promise<void> {
  await requireActor();
  await toggleShippingMethod(String(formData.get("id") ?? ""), formData.get("active") === "true");
  revalidatePath("/app/shipping");
}

export async function createTaxAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireActor();
  const result = await createTaxRule({
    name: String(formData.get("name") ?? ""),
    rate: String(formData.get("rate") ?? ""),
    inclusive: String(formData.get("inclusive") ?? "true") === "true",
  });
  if (!result.ok) return { error: result.message, field: result.field };
  revalidatePath("/app/taxes");
  return { ok: true };
}

export async function toggleTaxAction(formData: FormData): Promise<void> {
  await requireActor();
  await setTaxRuleActive(String(formData.get("id") ?? ""), formData.get("active") === "true");
  revalidatePath("/app/taxes");
}

/**
 * How customers sign in to this shop.
 *
 * Every value is whitelisted against its own literals rather than cast: these
 * arrive as form strings, and a value the enum does not have would be a database
 * error at best and a policy nobody chose at worst.
 */
export async function saveCustomerAccountsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireActor();

  const identifier = String(formData.get("identifier") ?? "email_only");
  const credential = String(formData.get("credential") ?? "both");
  const verification = String(formData.get("verification") ?? "before_checkout");

  const result = await saveCustomerAccountSettings({
    identifier:
      identifier === "phone_only" || identifier === "either" || identifier === "both"
        ? identifier
        : "email_only",
    credential: credential === "password" || credential === "code" ? credential : "both",
    verification:
      verification === "at_signup" || verification === "off" ? verification : "before_checkout",
  });

  if (!result.ok) return { error: result.message, field: result.field };
  revalidatePath("/app/settings");
  return { ok: true };
}

export async function saveSettingsAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireActor();
  const mode = String(formData.get("checkoutMode") ?? "guest");
  const result = await saveStoreSettings({
    checkoutMode:
      mode === "optional_account" || mode === "account_required" ? mode : "guest",
    requirePhone: flag(formData, "requirePhone"),
    allowOrderNotes: flag(formData, "allowOrderNotes"),
    showMarketingConsent: flag(formData, "showMarketingConsent"),
    gstin: String(formData.get("gstin") ?? ""),
  });
  if (!result.ok) return { error: result.message, field: result.field };
  revalidatePath("/app/settings");
  return { ok: true };
}
