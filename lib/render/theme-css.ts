import { FONT_STACKS, type Theme } from "@/lib/schema/theme";

/*
 * Compiles a storefront theme into CSS custom properties.
 *
 * Scoped to [data-storefront] rather than :root so a merchant's palette cannot
 * leak into BuilderHut's own chrome when the builder renders a canvas inside
 * the dashboard. The section components read only these variables, which is
 * what makes a theme change a variable swap instead of a re-render.
 */

/** Values are validated by ThemeSchema before reaching here; this is belt and braces. */
function safeColor(value: string): string {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : "#000000";
}

function num(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function relativeLuminance(hex: string): number {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = Number.parseInt(h, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/*
 * The colour a storefront shows a problem in.
 *
 * Deliberately NOT the merchant's accent, which is what the error states used
 * before: a shop with a green accent announced a declined card in the same
 * green as its "Add to basket" button, and a customer has no way to read that
 * as a warning. An error colour is a convention, not a brand decision — so
 * this is fixed, and only picks the shade that clears AA on the shop's own
 * background.
 *
 * Both values pass 4.5:1 against the surfaces they are chosen for.
 */
const DANGER_ON_LIGHT = "#b02318";
const DANGER_ON_DARK = "#ff9a8f";

function dangerFor(background: string): string {
  return relativeLuminance(background) > 0.35 ? DANGER_ON_LIGHT : DANGER_ON_DARK;
}

export function themeToCss(theme: Theme): string {
  const c = theme.colors;
  const t = theme.typography;
  const s = theme.shape;

  return `[data-storefront]{
--sf-bg:${safeColor(c.background)};
--sf-surface:${safeColor(c.surface)};
--sf-raised:${safeColor(c.raised)};
--sf-text:${safeColor(c.text)};
--sf-muted:${safeColor(c.muted)};
--sf-border:${safeColor(c.border)};
--sf-primary:${safeColor(c.primary)};
--sf-on-primary:${safeColor(c.onPrimary)};
--sf-accent:${safeColor(c.accent)};
--sf-danger:${dangerFor(safeColor(c.background))};
--sf-font-heading:${FONT_STACKS[t.heading]};
--sf-font-body:${FONT_STACKS[t.body]};
--sf-scale:${num(t.scale, 0.8, 1.4)};
--sf-heading-weight:${t.headingWeight};
--sf-heading-tracking:${num(t.headingTracking, -0.06, 0.2)}em;
--sf-heading-transform:${t.headingTransform};
--sf-radius:${num(s.radius, 0, 32)}px;
--sf-button-radius:${num(s.buttonRadius, 0, 999)}px;
--sf-section-y:${num(s.sectionSpacing, 32, 200)}px;
--sf-border-width:${num(s.borderWidth, 0, 3)}px;
}`;
}
