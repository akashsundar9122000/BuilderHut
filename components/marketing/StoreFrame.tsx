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
/*
 * A drawn stand-in for a product photograph.
 *
 * Deliberately a drawing and not a photograph. lib/marketing/sample-products.ts
 * makes the case and it holds here: putting stock photography in a shop that
 * does not exist is selling somebody else's pictures as the product. But an
 * empty grey square is not honest either — it shows none of what a template
 * does with a product grid, which is most of what separates one template from
 * another, and it reads as a page that failed to load.
 *
 * So: three simple silhouettes, inked in the template's own palette, at low
 * opacity. Clearly a drawing at any size, and no risk of being mistaken for a
 * thing anybody is selling. Three different shapes rather than one repeated,
 * because a row of identical marks reads as a loading state.
 */
function ProductMark({ index, ink }: { index: number; ink: string }) {
  /*
   * Kept to about a third of the tile and drawn lightly. A mark that fills its
   * box reads as a grey blob rather than as a thing sitting on a shelf, which
   * is the whole reason for drawing one.
   */
  const shapes = [
    // A vessel: narrow neck over a rounded body.
    <g key="vessel">
      <rect x="29" y="19" width="6" height="6" rx="1.5" />
      <path d="M24 26h16c1.6 3.4 2.4 6.8 2.4 10.2 0 4.8-3.4 7.4-10.4 7.4s-10.4-2.6-10.4-7.4c0-3.4.8-6.8 2.4-10.2z" />
    </g>,
    // A bowl: a shallow round with a rim above it.
    <g key="bowl">
      <ellipse cx="32" cy="29" rx="12" ry="2.6" />
      <path d="M20 30c0 7.2 4.6 12.6 12 12.6S44 37.2 44 30z" />
    </g>,
    // A box: a lid, a body and a ribbon.
    <g key="box">
      <rect x="21" y="28" width="22" height="15" rx="1.5" />
      <rect x="19" y="22" width="26" height="6.5" rx="1.5" />
      <rect x="30" y="22" width="4" height="21" rx="1" opacity="0.5" />
    </g>,
  ];

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {/* The ground it sits on, so the shape is not floating in a box. */}
      <ellipse cx="32" cy="45" rx="12" ry="2.2" fill={ink} opacity="0.09" />
      <g fill={ink} opacity="0.19">{shapes[index % shapes.length]}</g>
    </svg>
  );
}

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
      /*
       * One image, not a page. The miniature is drawn at a ninth of real size —
       * its 9px sample text is an impression of a shop, not something anyone is
       * meant to read, and holding it to a text contrast ratio would mean
       * drawing a picture of a storefront that looks nothing like one.
       *
       * So it is labelled as a whole and its innards are hidden from assistive
       * technology. Every fact it illustrates — the name, the blurb, the type
       * pairing, the corners, the trades — is real text in the card around it.
       */
      role="img"
      aria-label={`A preview of the ${template.name} template: ${template.blurb}`}
      style={{
        background: c.background,
        color: c.text,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${c.border}`,
        containerType: "inline-size",
      }}
    >
      <div aria-hidden="true" style={{ display: "contents" }}>
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
        {/*
          * The theme's own muted colour at full strength, not text faded to
          * 55%. Every template's muted clears AA against its background — the
          * blend did not, and a sighted reader with low vision still has to
          * look at this even though assistive technology does not.
          */}
        <span style={{ marginLeft: "auto", display: "flex", gap: 10, color: c.muted, fontSize: 10 }}>
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
                  position: "relative",
                  overflow: "hidden",
                  aspectRatio: "1 / 1",
                  background: i === 1 ? c.raised : c.surface,
                  border: `${s.borderWidth}px solid ${c.border}`,
                  borderRadius: s.radius,
                }}
              >
                <ProductMark index={i} ink={c.text} />
              </div>
              <p style={{ fontFamily: FONT_STACKS[t.body], fontSize: 10, marginTop: 5, marginBottom: 0 }}>
                {name}
              </p>
              <p style={{ fontFamily: FONT_STACKS[t.body], fontSize: 10, margin: 0, color: c.muted }}>
                ₹{[499, 349, 1299][i]}
              </p>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
