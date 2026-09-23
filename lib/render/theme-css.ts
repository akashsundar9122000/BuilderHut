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
