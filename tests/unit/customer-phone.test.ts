import { describe, expect, it } from "vitest";

import { DIAL_CODES, isE164, maskEmail, maskPhone, normalizePhone } from "@/lib/customers/phone";

/*
 * Mobile numbers, normalised to one shape.
 *
 * The stakes are not cosmetic: two shapes of the same number are two customer
 * accounts, and the second one to place an order is a stranger looking at
 * somebody's order history. The idempotence test at the bottom is the property
 * the database CHECK constraint depends on.
 */

describe("normalizePhone", () => {
  it("treats a typed country code as authoritative, whatever the shop's country", () => {
    expect(normalizePhone("+44 7911 123456", "IN")).toEqual({ ok: true, e164: "+447911123456" });
  });

  it("uses the shop's country when no code is typed", () => {
    expect(normalizePhone("9876543210", "IN")).toEqual({ ok: true, e164: "+919876543210" });
  });

  it("drops a leading trunk zero, which is national notation and not part of the number", () => {
    expect(normalizePhone("098765 43210", "IN")).toEqual({ ok: true, e164: "+919876543210" });
    expect(normalizePhone("07911 123456", "GB")).toEqual({ ok: true, e164: "+447911123456" });
  });

  it("ignores spaces, dashes, brackets and dots", () => {
    expect(normalizePhone("(415) 555-2671", "US")).toEqual({ ok: true, e164: "+14155552671" });
    expect(normalizePhone("98.765-43 210", "IN")).toEqual({ ok: true, e164: "+919876543210" });
  });

  it("asks for a country code rather than guessing one it does not know", () => {
    const result = normalizePhone("7911123456", "ZZ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("country code");
  });

  it("refuses something too short or too long to be a number", () => {
    expect(normalizePhone("+1234567", "IN").ok).toBe(false);
    expect(normalizePhone("+1234567890123456", "IN").ok).toBe(false);
  });

  it("refuses an empty value with something a person can act on", () => {
    expect(normalizePhone("   ", "IN")).toEqual({ ok: false, message: "Enter a mobile number." });
  });

  it("refuses a country code of zero, which no country has", () => {
    expect(normalizePhone("+0123456789", "IN").ok).toBe(false);
  });

  /*
   * The one the CHECK constraint rests on. If normalising twice differed from
   * normalising once, a row written by one path would be refused when another
   * path rewrote it, and the failure would surface as a random insert error.
   */
  it("is idempotent, which is what lets the column enforce its own shape", () => {
    for (const raw of ["9876543210", "098765 43210", "+44 7911 123456", "(415) 555-2671"]) {
      const once = normalizePhone(raw, "IN");
      expect(once.ok).toBe(true);
      if (!once.ok) continue;
      expect(normalizePhone(once.e164, "IN")).toEqual(once);
      expect(isE164(once.e164)).toBe(true);
    }
  });

  it("covers every country onboarding offers", () => {
    for (const country of ["IN", "GB", "US", "AE", "SG", "AU"]) {
      expect(DIAL_CODES[country]).toBeDefined();
      expect(normalizePhone("9876543210", country).ok).toBe(true);
    }
  });
});

describe("masking", () => {
  it("shows the country code and four digits, and no more", () => {
    const masked = maskPhone("+919876543210");
    expect(masked).toContain("+91");
    expect(masked).toContain("3210");
    expect(masked).not.toContain("98765");
  });

  it("prefers the longest matching dial code, so +971 is not read as +9", () => {
    expect(maskPhone("+971501234567").startsWith("+971")).toBe(true);
  });

  it("says something harmless when handed a number it cannot read", () => {
    expect(maskPhone("nonsense")).toBe("your mobile");
  });

  it("keeps the domain, which is how somebody recognises their own address", () => {
    expect(maskEmail("akash@example.com")).toBe("a••••@example.com");
  });

  it("never reveals more than the first letter of the local part", () => {
    expect(maskEmail("averyverylongaddress@example.com")).toMatch(/^a•+@example\.com$/);
  });

  it("says something harmless when handed something that is not an address", () => {
    expect(maskEmail("nonsense")).toBe("your email");
  });
});
