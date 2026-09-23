import { FONT_STACKS } from "@/lib/schema/theme";
import type { TemplateSummary } from "@/lib/templates";

/*
 * A miniature storefront, drawn from a template's real theme tokens.
 *
 * Not a screenshot. Screenshots go stale the moment a template changes, and
 * they cannot show that these are genuinely different type pairings and shapes
 * rather than one layout recoloured. This reads the same theme the storefront
 * renderer reads, so the marketing site cannot misrepresent the product.
 */
export function StoreFrame({
  template,
  productNames = ["Daisy posy", "Peony single", "Gift box"],
  className,
}: {
  template: TemplateSummary;
  productNames?: string[];
  className?: string;
}) {
  const { colors: c, typography: t, shape: s } = template.theme;

  return (
    <div
      className={className}
      style={{
        background: c.background,
        color: c.text,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${c.border}`,
        containerType: "inline-size",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderBottom: `${s.borderWidth}px solid ${c.border}`,
        }}
      >
        <span
          style={{
            fontFamily: FONT_STACKS[t.heading],
            fontWeight: t.headingWeight,
            letterSpacing: `${t.headingTracking}em`,
            textTransform: t.headingTransform,
            fontSize: 13,
          }}
        >
          {template.name}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 10, opacity: 0.55, fontSize: 9 }}>
          <span>Shop</span>
          <span>About</span>
        </span>
      </div>

      <div style={{ padding: "18px 14px 14px" }}>
        <p
          style={{
            fontFamily: FONT_STACKS[t.heading],
            fontWeight: t.headingWeight,
            letterSpacing: `${t.headingTracking}em`,
            textTransform: t.headingTransform,
            fontSize: `clamp(15px, 5cqi, 26px)`,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {template.blurb.split(",")[0]}
        </p>
        <span
          style={{
            display: "inline-block",
            marginTop: 12,
            padding: "6px 14px",
            fontSize: 10,
            fontFamily: FONT_STACKS[t.body],
            background: c.primary,
            color: c.onPrimary,
            borderRadius: s.buttonRadius,
          }}
        >
          Shop now
        </span>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 18 }}>
          {productNames.map((name, i) => (
            <div key={name}>
              <div
                style={{
                  aspectRatio: "1 / 1",
                  background: i === 1 ? c.raised : c.surface,
                  border: `${s.borderWidth}px solid ${c.border}`,
                  borderRadius: s.radius,
                }}
              />
              <p style={{ fontFamily: FONT_STACKS[t.body], fontSize: 9, marginTop: 5, marginBottom: 0, opacity: 0.85 }}>
                {name}
              </p>
              <p style={{ fontFamily: FONT_STACKS[t.body], fontSize: 9, margin: 0, color: c.muted }}>
                ₹{[499, 349, 1299][i]}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
