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
 * does not exist is selling somebody else's pictures as the product.
 *
 * But the first version of this drew a flat silhouette at 19% opacity over a
 * third of the tile, and at the size these are actually seen that reads as an
 * empty box — a page that failed to load rather than a shop with things in it.
 * So the drawing is now lit: a vertical gradient down the body, a soft glow
 * behind it and a contact shadow underneath. Enough depth for a 70px tile to
 * look like an object on a shelf, still unmistakably drawn at any size, and
 * inked entirely from the template's own palette so no two templates show the
 * same picture.
 *
 * Which shape a tile gets comes from the product's NAME, not its position, so
 * a gift box is drawn as a box and a tee as folded cloth. An earlier version
 * went by index and put a vase under "Tee 01", which reads as art chosen by a
 * machine that has not looked at the shop.
 */
const PRODUCT_SHAPES = [
  // A thrown vessel: narrow neck, shoulders, a foot.
  (fill: string) => (
    <>
      <path d="M28 17h8v6.5c0 .7.4 1.3 1 1.7 4 2.6 6.4 7 6.4 11.8v4.2c0 3.6-3.3 5.6-11.4 5.6s-11.4-2-11.4-5.6V37c0-4.8 2.4-9.2 6.4-11.8.6-.4 1-1 1-1.7z" fill={fill} />
      <rect x="27" y="14.5" width="10" height="3.6" rx="1.8" fill={fill} />
    </>
  ),
  // A shallow bowl with a lip.
  (fill: string) => (
    <>
      <path d="M19 28h26c0 8.4-5.2 14-13 14s-13-5.6-13-14z" fill={fill} />
      <ellipse cx="32" cy="27.6" rx="13" ry="3.1" fill={fill} />
    </>
  ),
  // A folded textile: two soft layers with a crease.
  (fill: string) => (
    <>
      <path d="M18 30c4-2.6 9-3.9 14-3.9s10 1.3 14 3.9v4.6c-4-2.6-9-3.9-14-3.9s-10 1.3-14 3.9z" fill={fill} />
      <path d="M18 36.4c4-2.6 9-3.9 14-3.9s10 1.3 14 3.9V41c-4-2.6-9-3.9-14-3.9s-10 1.3-14 3.9z" fill={fill} />
    </>
  ),
  // A framed print, leaning.
  (fill: string) => (
    <>
      <rect x="21" y="18" width="22" height="24" rx="1.6" fill={fill} />
      <path d="M24.5 36.5l4.6-5.6 3.3 3.9 3-3.4 4.1 5.1z" fill={fill} opacity="0.45" />
    </>
  ),
  // A pillar candle with a wick.
  (fill: string) => (
    <>
      <rect x="25" y="22" width="14" height="20" rx="2.2" fill={fill} />
      <ellipse cx="32" cy="22" rx="7" ry="2.1" fill={fill} opacity="0.55" />
      <rect x="31.4" y="17.5" width="1.2" height="4" rx="0.6" fill={fill} />
    </>
  ),
  // A tied box.
  (fill: string) => (
    <>
      <rect x="20" y="27" width="24" height="15.5" rx="1.8" fill={fill} />
      <rect x="18" y="21.5" width="28" height="6.4" rx="1.8" fill={fill} />
      <rect x="30" y="21.5" width="4" height="21" rx="1" fill={fill} opacity="0.5" />
    </>
  ),
];

/*
 * Roughly what the thing is, from what it is called.
 *
 * Deliberately crude: these are three sample names in a picture of a shop, not
 * a classifier. Anything unrecognised falls back to its position, which is what
 * the whole row used to do.
 */
const SHAPE_WORDS: [RegExp, number][] = [
  [/vase|pot|planter|jug|jar|mug|posy|bloom|flower|bottle|oil|balm/i, 0],
  [/bowl|dish|plate|platter|cup/i, 1],
  [/tee|shirt|throw|blanket|apron|runner|scarf|cushion|hat|cap|sock|cloth|linen/i, 2],
  [/print|art|poster|card|invitation|suite|study|sketch|frame|menu|template|preset/i, 3],
  [/candle|pillar|wax|soap/i, 4],
  [/box|hamper|gift|kit|set|bundle/i, 5],
];

function shapesFor(names: readonly string[]): number[] {
  const used = new Set<number>();
  return names.map((name, i) => {
    const match = SHAPE_WORDS.find(([re]) => re.test(name));
    let pick = match ? match[1] : i % PRODUCT_SHAPES.length;
    /*
     * Two tiles showing the same drawing reads as a loading state rather than
     * as a shelf, so a collision walks to the next free shape.
     */
    while (used.has(pick)) pick = (pick + 1) % PRODUCT_SHAPES.length;
    used.add(pick);
    return pick;
  });
}

function ProductMark({
  index,
  shape,
  ink,
  accent,
}: {
  index: number;
  shape: number;
  ink: string;
  accent: string;
}) {
  /*
   * Unique per instance. Three tiles share one component, and three gradients
   * called "g" would leave every tile painted with whichever one the browser
   * resolved last — the sort of bug that looks like a rendering glitch.
   */
  const id = `pm${index}`;
  const draw = PRODUCT_SHAPES[shape % PRODUCT_SHAPES.length]!;

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        {/*
         * Lit from above, in the template's own ink. Opacity rather than a
         * mixed colour, so the object sits on whatever the tile's background
         * happens to be — these templates range from warm paper to near black.
         */}
        {/*
         * Led by the template's primary rather than its text colour.
         *
         * Primary is the button colour, so it is the one shade guaranteed to
         * carry against the background whichever way round the theme runs.
         * Inking these in text colour looked like stoneware on the light
         * templates and like a smudge on the dark ones — a near-black object on
         * a near-black tile. Leading with primary gives terracotta on Thread and
         * warm brass on Facet, from the same four lines.
         */}
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.34" />
          <stop offset="0.52" stopColor={accent} stopOpacity="0.62" />
          <stop offset="1" stopColor={ink} stopOpacity="0.42" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.22" r="0.75">
          <stop offset="0" stopColor={ink} stopOpacity="0.07" />
          <stop offset="1" stopColor={ink} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The light in the room, so the tile is not flat behind the object. */}
      <rect width="64" height="64" fill={`url(#${id}-glow)`} />
      {/* What it stands on. Soft and wide, or the object looks pasted on. */}
      <ellipse cx="32" cy="45.4" rx="13" ry="2.6" fill={ink} opacity="0.13" />

      {draw(`url(#${id}-body)`)}
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
  const shapes = shapesFor(productNames);

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
                <ProductMark index={i} shape={shapes[i]!} ink={c.text} accent={c.primary} />
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
