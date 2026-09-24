import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";

import { getRootDb } from "@/lib/db/client";
import { storeSettings, tenants } from "@/lib/db/schema";
import { withTenant, type TenantDb } from "@/lib/db/tenant";
import { hasFeature } from "@/lib/plans/entitlements";
import { normalizePhone } from "./phone";

/*
 * What a store's sign-in rules are, in one place.
 *
 * Three settings and a checkout mode decide the whole of this feature's
 * behaviour, and they are consulted by the sign-up form, the sign-in form, the
 * checkout page and placeOrder(). Four copies of "is an account required here?"
 * is four chances for them to disagree, and the one that disagrees is always the
 * one furthest from the screen — the one that actually decides.
 *
 * So nothing outside this file reads storeSettings.customer* or checkoutMode.
 */

export type IdentifierMode = "email_only" | "phone_only" | "either" | "both";
export type CredentialMode = "password" | "code" | "both";
export type VerificationMode = "at_signup" | "before_checkout" | "off";
export type CheckoutMode = "guest" | "optional_account" | "account_required";
export type IdentifierKind = "email" | "phone";

export interface CustomerPolicy {
  tenantId: string;
  identifier: IdentifierMode;
  credential: CredentialMode;
  verification: VerificationMode;
  checkout: CheckoutMode;
  requirePhone: boolean;
  showMarketingConsent: boolean;
  requireTermsAcceptance: boolean;
  /** tenants.country — the default when normalising a typed mobile number. */
  country: string;
  /** From the plan, not the settings row. False on Starter. */
  smsAllowed: boolean;
}

/** The store's own defaults, for a shop that has never opened its settings. */
const DEFAULTS = {
  identifier: "email_only",
  credential: "both",
  verification: "before_checkout",
  checkout: "guest",
  requirePhone: true,
  showMarketingConsent: true,
  requireTermsAcceptance: false,
} as const;

/**
 * Primitive: reads through the caller's open transaction.
 *
 * tenants.country and the plan come off the root connection, which is safe
 * inside a tenant transaction and is what planFor() already does — `tenants` is
 * a platform table and carries no policy.
 */
export async function readPolicy(db: TenantDb): Promise<CustomerPolicy> {
  const tenantId = db.ctx.tenantId;
  const [settings] = await db.select(storeSettings).limit(1);
  const [tenant] = await getRootDb()
    .select({ country: tenants.country })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return {
    tenantId,
    identifier: settings?.customerIdentifier ?? DEFAULTS.identifier,
    credential: settings?.customerCredential ?? DEFAULTS.credential,
    verification: settings?.customerVerification ?? DEFAULTS.verification,
    checkout: settings?.checkoutMode ?? DEFAULTS.checkout,
    requirePhone: settings?.requirePhone ?? DEFAULTS.requirePhone,
    showMarketingConsent: settings?.showMarketingConsent ?? DEFAULTS.showMarketingConsent,
    requireTermsAcceptance: settings?.requireTermsAcceptance ?? DEFAULTS.requireTermsAcceptance,
    country: tenant?.country ?? "IN",
    smsAllowed: await hasFeature(tenantId, "customerPhoneAuth"),
  };
}

/**
 * Entry point. Opens its own transaction — never call it from inside one.
 *
 * React cache(), deliberately not unstable_cache(): a merchant who switches
 * their shop to "account required" must have it be true on the next request, and
 * the "storefront" tag revalidates on a five-minute timer. Credential rules are
 * not a thing to serve stale.
 */
export const loadPolicy = cache(async (tenantId: string): Promise<CustomerPolicy> => {
  return withTenant({ tenantId, actorId: tenantId, role: "staff" }, (db) => readPolicy(db));
});

/* ── what the policy means ──────────────────────────────────────────────── */

/** An "@" is the only thing that distinguishes the two. Nothing else guesses. */
export function classifyIdentifier(raw: string): IdentifierKind | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes("@")) return "email";
  return /[0-9]/.test(trimmed) ? "phone" : null;
}

export function acceptedIdentifiers(policy: CustomerPolicy): IdentifierKind[] {
  switch (policy.identifier) {
    case "email_only":
      return ["email"];
    case "phone_only":
      return ["phone"];
    default:
      return ["email", "phone"];
  }
}

/** "both" means both are collected at sign-up and both must be proven. */
export function bothIdentifiersRequired(policy: CustomerPolicy): boolean {
  return policy.identifier === "both";
}

export function passwordsAllowed(policy: CustomerPolicy): boolean {
  return policy.credential === "password" || policy.credential === "both";
}

export function codesAllowed(policy: CustomerPolicy): boolean {
  return policy.credential === "code" || policy.credential === "both";
}

export type PolicyRefusal = { ok: false; message: string; field?: "identifier" | "password" | "code" };

export type IdentifierCheck =
  | { ok: true; kind: IdentifierKind; normalized: string }
  | PolicyRefusal;

/**
 * Is this something a customer can sign in to THIS store with?
 *
 * The one place a typed mobile number is normalised, so "stored in E.164 only"
 * cannot be forgotten at one of five call sites. Refusals here are about the
 * store's rules, never about whether a particular person has an account — those
 * are safe to state plainly, because they reveal nothing about anybody.
 */
export function checkIdentifier(policy: CustomerPolicy, raw: string): IdentifierCheck {
  const kind = classifyIdentifier(raw);
  const accepted = acceptedIdentifiers(policy);

  if (!kind) {
    return {
      ok: false,
      field: "identifier",
      message:
        accepted.length === 1 && accepted[0] === "phone"
          ? "Enter your mobile number."
          : accepted.length === 1
            ? "Enter your email address."
            : "Enter your email address or mobile number.",
    };
  }

  if (!accepted.includes(kind)) {
    return {
      ok: false,
      field: "identifier",
      message:
        kind === "phone"
          ? "This shop signs people in by email address."
          : "This shop signs people in by mobile number.",
    };
  }

  if (kind === "phone" && !policy.smsAllowed) {
    /*
     * The shop chose phone sign-in on a plan that includes it and has since
     * moved down. Said plainly to the customer without blaming them, and the
     * merchant sees the same thing named properly in their own settings.
     */
    return {
      ok: false,
      field: "identifier",
      message: "This shop can't sign people in by mobile number at the moment.",
    };
  }

  if (kind === "email") {
    const email = raw.trim().toLowerCase();
    // Deliberately loose. An address either receives the code or it does not,
    // and elaborate regexes reject real addresses more often than fake ones.
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
      return {
        ok: false,
        field: "identifier",
        message: "That doesn't look like an email address.",
      };
    }
    return { ok: true, kind, normalized: email };
  }

  const phone = normalizePhone(raw, policy.country);
  if (!phone.ok) return { ok: false, field: "identifier", message: phone.message };
  return { ok: true, kind, normalized: phone.e164 };
}

/**
 * Claiming an existing record always costs a verified code.
 *
 * Takes no policy on purpose. A store's verification setting decides how new
 * accounts are treated; it does not get a say in this, because the row being
 * claimed may already hold somebody's orders, delivery address and phone number,
 * and "off" must never mean "hand that over to whoever types the address".
 * Written as a function so the rule is visible at the call site rather than
 * being an `if` somebody later makes configurable.
 */
export function codeRequiredToClaim(): true {
  return true;
}

export function codeRequiredAtSignup(policy: CustomerPolicy): boolean {
  return policy.verification === "at_signup";
}

export function verificationRequiredBeforeCheckout(policy: CustomerPolicy): boolean {
  return policy.verification !== "off";
}

/** Just enough of a signed-in customer for the gate to decide. */
export interface GateSubject {
  emailVerified: boolean;
  phoneVerified: boolean;
  email: string | null;
  phone: string | null;
}

export type CheckoutGate =
  | { ok: true }
  | { ok: false; reason: "needs_account" | "needs_verification"; message: string };

/** Has this customer proven the identifier their account is reachable by? */
export function identifierProven(policy: CustomerPolicy, subject: GateSubject): boolean {
  const emailOk = subject.email !== null && subject.emailVerified;
  const phoneOk = subject.phone !== null && subject.phoneVerified;
  switch (policy.identifier) {
    case "email_only":
      return emailOk;
    case "phone_only":
      return phoneOk;
    case "both":
      return emailOk && phoneOk;
    default:
      return emailOk || phoneOk;
  }
}

/**
 * May this person place an order?
 *
 * One function, consulted by the checkout page (which redirects) and by
 * placeOrder() (which refuses). The page is a courtesy; the refusal is the rule.
 */
export function checkoutGate(policy: CustomerPolicy, subject: GateSubject | null): CheckoutGate {
  if (!subject) {
    if (policy.checkout === "account_required") {
      return {
        ok: false,
        reason: "needs_account",
        message: "This shop asks you to sign in before ordering.",
      };
    }
    return { ok: true };
  }

  if (verificationRequiredBeforeCheckout(policy) && !identifierProven(policy, subject)) {
    return {
      ok: false,
      reason: "needs_verification",
      message: "Please confirm your contact details before ordering — we'll send you a code.",
    };
  }
  return { ok: true };
}
