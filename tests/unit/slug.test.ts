import { describe, expect, it } from "vitest";
import { checkSlug, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("turns a business name into an address", () => {
    expect(slugify("Thread & Bloom")).toBe("thread-bloom");
    expect(slugify("  Akash's Cake Studio!  ")).toBe("akash-s-cake-studio");
  });

  it("strips accents rather than dropping the letters", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });

  it("never ends on a hyphen, even when truncating", () => {
    const long = slugify("a".repeat(38) + " and something else entirely");
    expect(long.endsWith("-")).toBe(false);
    expect(long.length).toBeLessThanOrEqual(40);
  });
});

describe("checkSlug", () => {
  it("accepts ordinary store addresses", () => {
    for (const s of ["thread-bloom", "cake99", "a1b"]) {
      expect(checkSlug(s).ok, s).toBe(true);
    }
  });

  it("rejects addresses that would shadow a platform route", () => {
    // A store at /login would take over the sign-in page.
    for (const s of ["login", "admin", "api", "app", "checkout"]) {
      expect(checkSlug(s).ok, s).toBe(false);
    }
  });

  it("rejects brand impersonation", () => {
    for (const s of ["paypal", "hdfc", "instagram", "aadhaar"]) {
      expect(checkSlug(s).ok, s).toBe(false);
    }
  });

  it("rejects malformed addresses", () => {
    for (const s of ["ab", "-leading", "trailing-", "Upper", "has space", "double--hyphen", "under_score"]) {
      expect(checkSlug(s).ok, s).toBe(false);
    }
  });

  it("explains itself", () => {
    const result = checkSlug("Upper");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/lowercase/);
  });
});
