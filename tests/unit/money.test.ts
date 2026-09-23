import { describe, expect, it } from "vitest";
import { discountPercent, exponentOf, formatMoney, parseMoney } from "@/lib/money";

describe("minor units", () => {
  it("knows currencies that are not two decimal places", () => {
    expect(exponentOf("INR")).toBe(2);
    expect(exponentOf("JPY")).toBe(0);
    expect(exponentOf("KWD")).toBe(3);
  });

  it("formats rupees with Indian digit grouping", () => {
    // 1,24,500 not 124,500 — a merchant in Chennai notices immediately.
    expect(formatMoney(12450000, "INR")).toContain("1,24,500");
  });

  it("formats zero-decimal currencies without decimals", () => {
    expect(formatMoney(1500, "JPY", "en-US")).not.toContain(".");
  });

  it("does not throw on an unknown currency code", () => {
    expect(formatMoney(1000, "ZZZ")).toContain("10");
  });
});

describe("parseMoney", () => {
  it("converts what a merchant types into minor units", () => {
    expect(parseMoney("1499", "INR")).toBe(149900);
    expect(parseMoney("1499.50", "INR")).toBe(149950);
    expect(parseMoney("1,499", "INR")).toBe(149900);
    expect(parseMoney("0", "INR")).toBe(0);
  });

  it("rejects more precision than the currency has", () => {
    // 10.999 rupees is not a price; silently rounding it would lose money.
    expect(parseMoney("10.999", "INR")).toBeNull();
    expect(parseMoney("10.5", "JPY")).toBeNull();
  });

  it("rejects anything that is not a number", () => {
    for (const bad of ["", "-5", "abc", "1.2.3", "1e5", "₹100"]) {
      expect(parseMoney(bad, "INR"), bad).toBeNull();
    }
  });

  it("round-trips without floating point drift", () => {
    // The classic: 0.1 + 0.2 !== 0.3. In minor units it is 10 + 20 === 30.
    const a = parseMoney("0.10", "INR")!;
    const b = parseMoney("0.20", "INR")!;
    expect(a + b).toBe(parseMoney("0.30", "INR"));
  });
});

describe("discountPercent", () => {
  it("computes the badge value", () => {
    expect(discountPercent(75000, 100000)).toBe(25);
  });

  it("returns nothing when there is no genuine discount", () => {
    expect(discountPercent(100000, null)).toBeNull();
    expect(discountPercent(100000, 100000)).toBeNull();
    expect(discountPercent(100000, 90000)).toBeNull(); // "was" cheaper than now
  });
});
