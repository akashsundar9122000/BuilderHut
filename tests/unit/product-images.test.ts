import { describe, expect, it } from "vitest";

import { imageUrlFor, mediaKeyFrom } from "@/lib/products/service";

/*
 * A product image is stored as either a library key or a URL the merchant
 * pasted, and the two have to survive a round trip through the edit form —
 * otherwise saving a product without touching its pictures rewrites them.
 */
describe("product image addresses", () => {
  it("serves a library key from the media route", () => {
    expect(imageUrlFor("t/abc/def123.jpg")).toBe("/media/t/abc/def123.jpg");
  });

  it("leaves an absolute address alone", () => {
    for (const url of ["https://cdn.example.com/a.jpg", "http://example.com/b.png"]) {
      expect(imageUrlFor(url)).toBe(url);
    }
  });

  it("round-trips a library asset", () => {
    const key = "t/abc/def123.jpg";
    expect(mediaKeyFrom(imageUrlFor(key))).toBe(key);
  });

  it("round-trips a pasted address", () => {
    const url = "https://cdn.example.com/a.jpg";
    expect(mediaKeyFrom(imageUrlFor(url))).toBe(url);
  });

  it("does not mistake a hosted URL containing /media/ for a key", () => {
    const url = "https://cdn.example.com/media/a.jpg";
    expect(mediaKeyFrom(url)).toBe(url);
  });
});
