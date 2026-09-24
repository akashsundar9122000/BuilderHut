import { describe, expect, it } from "vitest";

import {
  acceptedIdentifiers,
  checkIdentifier,
  checkoutGate,
  classifyIdentifier,
  codeRequiredAtSignup,
  codeRequiredToClaim,
  codesAllowed,
  identifierProven,
  passwordsAllowed,
  type CustomerPolicy,
  type GateSubject,
} from "@/lib/customers/policy";

/*
 * The rules a store's sign-in behaviour is decided by.
 *
 * These are pure on purpose: the same functions are consulted by the sign-up
 * form, the sign-in form, the checkout page and placeOrder(), and the whole point
 * of extracting them is that the answer cannot differ between the screen and the
 * write. The gate table below is what stops somebody re-deriving it in a fifth
 * place and getting it subtly wrong.
 */

function policy(over: Partial<CustomerPolicy> = {}): CustomerPolicy {
  return {
    tenantId: "t1",
    identifier: "either",
    credential: "both",
    verification: "before_checkout",
    checkout: "guest",
    requirePhone: true,
    showMarketingConsent: true,
    requireTermsAcceptance: false,
    country: "IN",
    smsAllowed: true,
    ...over,
  };
}

function subject(over: Partial<GateSubject> = {}): GateSubject {
  return {
    email: "shopper@example.com",
    phone: null,
    emailVerified: true,
    phoneVerified: false,
    ...over,
  };
}

describe("classifyIdentifier", () => {
  it("uses the @ and nothing else", () => {
    expect(classifyIdentifier("a@b.com")).toBe("email");
    expect(classifyIdentifier("9876543210")).toBe("phone");
    expect(classifyIdentifier("+91 98765 43210")).toBe("phone");
  });

  it("refuses to guess at something that is neither", () => {
    expect(classifyIdentifier("")).toBeNull();
    expect(classifyIdentifier("akash")).toBeNull();
  });
});

describe("what a store accepts", () => {
  it("follows the four identifier modes", () => {
    expect(acceptedIdentifiers(policy({ identifier: "email_only" }))).toEqual(["email"]);
    expect(acceptedIdentifiers(policy({ identifier: "phone_only" }))).toEqual(["phone"]);
    expect(acceptedIdentifiers(policy({ identifier: "either" }))).toEqual(["email", "phone"]);
    expect(acceptedIdentifiers(policy({ identifier: "both" }))).toEqual(["email", "phone"]);
  });

  it("follows the three credential modes", () => {
    expect(passwordsAllowed(policy({ credential: "password" }))).toBe(true);
    expect(codesAllowed(policy({ credential: "password" }))).toBe(false);
    expect(passwordsAllowed(policy({ credential: "code" }))).toBe(false);
    expect(codesAllowed(policy({ credential: "code" }))).toBe(true);
    expect(passwordsAllowed(policy({ credential: "both" }))).toBe(true);
    expect(codesAllowed(policy({ credential: "both" }))).toBe(true);
  });
});

describe("checkIdentifier", () => {
  it("normalises an email to lower case", () => {
    expect(checkIdentifier(policy(), "Akash@Example.COM")).toEqual({
      ok: true,
      kind: "email",
      normalized: "akash@example.com",
    });
  });

  it("normalises a mobile number to E.164 using the store's country", () => {
    expect(checkIdentifier(policy({ country: "IN" }), "098765 43210")).toEqual({
      ok: true,
      kind: "phone",
      normalized: "+919876543210",
    });
  });

  it("turns a phone away from an email-only store, and says so about the store", () => {
    const result = checkIdentifier(policy({ identifier: "email_only" }), "9876543210");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("This shop signs people in by email address.");
  });

  it("turns a phone away when the plan does not include SMS", () => {
    const result = checkIdentifier(policy({ smsAllowed: false }), "9876543210");
    expect(result.ok).toBe(false);
    // The customer is not told about somebody else's billing; the merchant sees
    // the plan named in their own settings instead.
    if (!result.ok) expect(result.message).not.toMatch(/plan|Standard|Starter/i);
  });

  it("asks for the right thing when the field is empty", () => {
    const emailOnly = checkIdentifier(policy({ identifier: "email_only" }), "");
    const phoneOnly = checkIdentifier(policy({ identifier: "phone_only" }), "");
    const either = checkIdentifier(policy(), "");
    if (!emailOnly.ok) expect(emailOnly.message).toBe("Enter your email address.");
    if (!phoneOnly.ok) expect(phoneOnly.message).toBe("Enter your mobile number.");
    if (!either.ok) expect(either.message).toBe("Enter your email address or mobile number.");
  });

  it("refuses an address with no domain", () => {
    expect(checkIdentifier(policy(), "akash@localhost").ok).toBe(false);
  });
});

/*
 * The regression test for the one security decision in this feature.
 *
 * Claiming an existing record always costs a verified code, whatever the store's
 * verification setting says — because that record may already hold somebody's
 * orders, delivery address and phone number.
 */
describe("claiming an existing record", () => {
  it("always needs a code, even where the store verifies nobody", () => {
    expect(codeRequiredToClaim()).toBe(true);
    // And the function takes no policy, so no setting can be threaded into it.
    expect(codeRequiredToClaim.length).toBe(0);
  });

  it("is not the same question as whether a NEW account needs one", () => {
    expect(codeRequiredAtSignup(policy({ verification: "at_signup" }))).toBe(true);
    expect(codeRequiredAtSignup(policy({ verification: "before_checkout" }))).toBe(false);
    expect(codeRequiredAtSignup(policy({ verification: "off" }))).toBe(false);
  });
});

describe("identifierProven", () => {
  it("wants the identifier the store actually signs people in with", () => {
    const emailVerified = subject({ emailVerified: true });
    expect(identifierProven(policy({ identifier: "email_only" }), emailVerified)).toBe(true);
    expect(identifierProven(policy({ identifier: "phone_only" }), emailVerified)).toBe(false);
  });

  it("wants both where the store asks for both", () => {
    const one = subject({ phone: "+919876543210", phoneVerified: false });
    const two = subject({ phone: "+919876543210", phoneVerified: true });
    expect(identifierProven(policy({ identifier: "both" }), one)).toBe(false);
    expect(identifierProven(policy({ identifier: "both" }), two)).toBe(true);
  });

  it("accepts either where either will do", () => {
    const phoneOnly = subject({ email: null, emailVerified: false, phone: "+919876543210", phoneVerified: true });
    expect(identifierProven(policy({ identifier: "either" }), phoneOnly)).toBe(true);
  });
});

/*
 * The whole gate, as a table. Written out rather than looped so a failing row
 * names the case, and so somebody reading it can see the rule at a glance.
 */
describe("checkoutGate", () => {
  const unverified = subject({ emailVerified: false });
  const verified = subject({ emailVerified: true });

  it("lets a guest through a guest checkout", () => {
    expect(checkoutGate(policy({ checkout: "guest" }), null)).toEqual({ ok: true });
  });

  it("lets a guest through an optional-account checkout", () => {
    expect(checkoutGate(policy({ checkout: "optional_account" }), null)).toEqual({ ok: true });
  });

  it("stops a guest where an account is required", () => {
    const gate = checkoutGate(policy({ checkout: "account_required" }), null);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reason).toBe("needs_account");
  });

  it("stops an unverified customer wherever the store verifies at all", () => {
    for (const checkout of ["guest", "optional_account", "account_required"] as const) {
      const gate = checkoutGate(policy({ checkout, verification: "before_checkout" }), unverified);
      expect(gate.ok, checkout).toBe(false);
      if (!gate.ok) expect(gate.reason).toBe("needs_verification");
    }
  });

  it("lets an unverified customer through where the store verifies nobody", () => {
    for (const checkout of ["guest", "optional_account", "account_required"] as const) {
      expect(checkoutGate(policy({ checkout, verification: "off" }), unverified), checkout).toEqual({
        ok: true,
      });
    }
  });

  it("lets a verified customer through everywhere", () => {
    for (const checkout of ["guest", "optional_account", "account_required"] as const) {
      for (const verification of ["at_signup", "before_checkout", "off"] as const) {
        expect(
          checkoutGate(policy({ checkout, verification }), verified),
          `${checkout}/${verification}`,
        ).toEqual({ ok: true });
      }
    }
  });
});
