import { afterEach, describe, expect, it } from "vitest";

import { CODE_MINUTES, MAX_ATTEMPTS, codeExpiry, codesMatch, generateCode, hashCode } from "@/lib/customers/codes";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("generateCode", () => {
  it("is always six digits, zero-padded", () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateCode()).toMatch(/^\d{6}$/);
    }
  });

  it("does not return the same code every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("hashCode", () => {
  it("is stable for the same code", () => {
    expect(hashCode("123456")).toBe(hashCode("123456"));
  });

  it("is not the code", () => {
    expect(hashCode("123456")).not.toContain("123456");
  });

  /*
   * The keyed part is the point. An unkeyed digest of a six-digit code is a
   * million-entry lookup table, so a database dump would be enough to read every
   * code in flight.
   */
  it("differs under a different deployment secret", () => {
    process.env.BETTER_AUTH_SECRET = "a".repeat(32);
    const first = hashCode("123456");
    process.env.BETTER_AUTH_SECRET = "b".repeat(32);
    expect(hashCode("123456")).not.toBe(first);
  });
});

describe("codesMatch", () => {
  it("accepts the right code", () => {
    expect(codesMatch(hashCode("123456"), "123456")).toBe(true);
  });

  it("rejects the wrong one", () => {
    expect(codesMatch(hashCode("123456"), "123457")).toBe(false);
  });

  it("rejects a stored value of the wrong length without throwing", () => {
    // timingSafeEqual throws on a length mismatch, which would itself be a leak.
    expect(codesMatch("deadbeef", "123456")).toBe(false);
    expect(codesMatch("", "123456")).toBe(false);
  });

  it("rejects a non-hex stored value without throwing", () => {
    expect(codesMatch("not hex at all", "123456")).toBe(false);
  });
});

describe("the numbers", () => {
  it("match the merchant realm, so the two flows behave alike", () => {
    expect(CODE_MINUTES).toBe(10);
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("expires ten minutes out", () => {
    const now = new Date("2026-09-24T10:00:00Z");
    expect(codeExpiry(now).toISOString()).toBe("2026-09-24T10:10:00.000Z");
  });
});
