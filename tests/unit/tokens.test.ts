import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  path.join(import.meta.dirname, "..", "..", "styles", "tokens.css"),
  "utf8",
);

/*
 * Tailwind v4 emits a theme variable only when some utility references it, so a
 * variable used solely inside an inline `style={{}}` is tree-shaken out of the
 * stylesheet and the property silently resolves to nothing. Every bar and line
 * on the analytics dashboard rendered colourless before that was understood.
 *
 * The rule that follows: inline styles use the authored --bh-* tokens, which
 * live in a plain :root block and are always emitted. Class names use the
 * utilities. These tests pin both halves of that.
 */
describe("design tokens", () => {
  it("authors every chart colour as a --bh-* custom property", () => {
    for (let i = 1; i <= 6; i++) {
      expect(CSS, `--bh-chart-${i} missing`).toContain(`--bh-chart-${i}:`);
    }
  });

  it("maps every chart colour onto a Tailwind utility as well", () => {
    // Tailwind reads colours from --color-*; a different prefix renders black.
    for (let i = 1; i <= 6; i++) {
      expect(CSS).toContain(`--color-chart-${i}: var(--bh-chart-${i})`);
    }
  });

  it("defines the dark theme in both the media query and the explicit scope", () => {
    // An explicit choice has to win in BOTH directions; a single media-query
    // block cannot turn dark on for someone whose OS is light.
    expect(CSS).toContain('@media (prefers-color-scheme: dark)');
    expect(CSS).toContain(':root[data-theme="dark"]');
  });

  it("names every colour token --color-* in the theme block", () => {
    // Tailwind v4 only treats --color-* as colours. A token mapped under any
    // other prefix compiles to a utility that renders black.
    const theme = CSS.slice(CSS.indexOf("@theme inline"));
    const mapped = [...theme.matchAll(/--([\w-]+): var\(--bh-([\w-]+)\)/g)].map(
      (m) => ({ utility: m[1] ?? "", token: m[2] ?? "" }),
    );
    const colourish = mapped.filter(({ token }) =>
      /^(canvas|surface|raised|sunken|overlay|border|text|muted|faint|accent|success|warning|danger|info|chart|on-)/.test(
        token,
      ),
    );
    expect(colourish.length).toBeGreaterThan(10);
    for (const { utility, token } of colourish) {
      expect(utility.startsWith("color-"), `--${utility} (from --bh-${token}) should be a --color-* name`).toBe(true);
    }
  });
});
