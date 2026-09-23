import { describe, expect, it } from "vitest";

import { themeToCss } from "@/lib/render/theme-css";
import { TEMPLATES } from "@/lib/templates";

/*
 * Every template must be readable the moment it is published.
 *
 * A merchant can choose any colours they like afterwards — it is their shop —
 * but the twelve we ship are ours, and a starting point that fails AA is a
 * starting point that fails their customers. This is the same arithmetic as
 * scripts/check-contrast.ts, applied to storefront themes rather than to
 * BuilderHut's own tokens.
 */

function channels(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe.each(TEMPLATES.map((t) => [t.id, t] as const))("%s is readable", (_id, template) => {
  const c = template.theme.colors;
  const surfaces = [
    ["page", c.background],
    ["cards", c.surface],
    ["tinted bands", c.raised],
  ] as const;

  it.each(surfaces)("has body text that clears AA on the %s", (_name, bg) => {
    expect(ratio(c.text, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)("has quiet text that clears AA on the %s", (_name, bg) => {
    // Muted carries prices, captions and footer links. It is body text.
    expect(ratio(c.muted, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)("has an accent readable as small text on the %s", (_name, bg) => {
    // Templates use the accent for eyebrows and links, at small sizes.
    expect(ratio(c.accent, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("has a button label readable on its button", () => {
    expect(ratio(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)("has a button visible against the %s", (_name, bg) => {
    // A filled control's own boundary is non-text contrast: WCAG 1.4.11, 3:1.
    expect(ratio(c.primary, bg)).toBeGreaterThanOrEqual(3);
  });

  /*
   * Only against the page and cards — the two surfaces borders are actually
   * drawn on. A tinted band is a full-bleed colour block, not something with
   * hairlines inside it, and asserting that pair invented a requirement the
   * design does not have.
   */
  it.each(surfaces.slice(0, 2))("has lines visible against the %s", (_name, bg) => {
    expect(ratio(c.border, bg)).toBeGreaterThanOrEqual(1.18);
  });
});

/*
 * The storefront's error colour is not the merchant's accent.
 *
 * It used to be, and a shop with a green accent announced a declined card in
 * the same green as its "Add to basket" button. Errors are a convention, so
 * the colour is fixed and only varies by whether the shop is light or dark.
 */
describe("the storefront error colour", () => {
  it("clears AA on every template's own surfaces", () => {
    for (const template of TEMPLATES) {
      const css = themeToCss(template.theme);
      const danger = /--sf-danger:(#[0-9a-f]{6})/.exec(css)![1]!;
      for (const bg of [
        template.theme.colors.background,
        template.theme.colors.surface,
        template.theme.colors.raised,
      ]) {
        expect(ratio(danger, bg), `${template.id} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("is never the merchant's own accent", () => {
    for (const template of TEMPLATES) {
      const danger = /--sf-danger:(#[0-9a-f]{6})/.exec(themeToCss(template.theme))![1]!;
      expect(danger, template.id).not.toBe(template.theme.colors.accent.toLowerCase());
    }
  });
});
