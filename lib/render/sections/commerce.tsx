import { z } from "zod";
import { discountPercent, formatMoney } from "@/lib/money";
import { linkTo, type ProductCard, type RenderContext } from "../context";
import { AlignSchema, Heading, ImageSlot, Lede, SectionShell, ToneSchema } from "./shared";

/* The catalogue. This is where a storefront stops being a brochure. */

export const ProductGridProps = z.object({
  heading: z.string().max(120).default("Shop"),
  body: z.string().max(240).default(""),
  /** Which products, resolved server-side — never a raw query from the browser. */
  source: z.enum(["all", "featured", "newest"]).default("newest"),
  limit: z.number().int().min(1).max(24).default(8),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
  cardStyle: z.enum(["plain", "bordered", "elevated"]).default("plain"),
  imageRatio: z.enum(["square", "portrait", "landscape"]).default("square"),
  showPrice: z.boolean().default(true),
  align: AlignSchema,
  tone: ToneSchema,
});

const RATIOS = { square: "1 / 1", portrait: "3 / 4", landscape: "4 / 3" };

export function ProductGrid({
  props,
  ctx,
}: {
  props: z.infer<typeof ProductGridProps>;
  ctx: RenderContext;
}) {
  const products = ctx.products.slice(0, props.limit);

  return (
    <SectionShell tone={props.tone}>
      {props.heading || props.body ? (
        <div
          className="mb-10 flex flex-col gap-3"
          style={{ alignItems: props.align === "center" ? "center" : undefined }}
        >
          {props.heading ? <Heading align={props.align}>{props.heading}</Heading> : null}
          {props.body ? <Lede align={props.align}>{props.body}</Lede> : null}
        </div>
      ) : null}

      {products.length === 0 ? (
        <EmptyCatalogue editing={ctx.editing} columns={props.columns} ratio={RATIOS[props.imageRatio]} />
      ) : (
        <div
          className="grid gap-x-5 gap-y-9"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${props.columns >= 4 ? 200 : 240}px, 1fr))` }}
        >
          {products.map((product) => (
            <ProductTile
              key={product.id}
              product={product}
              ctx={ctx}
              ratio={RATIOS[props.imageRatio]}
              cardStyle={props.cardStyle}
              showPrice={props.showPrice}
            />
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function ProductTile({
  product,
  ctx,
  ratio,
  cardStyle,
  showPrice,
}: {
  product: ProductCard;
  ctx: RenderContext;
  ratio: string;
  cardStyle: string;
  showPrice: boolean;
}) {
  const off = discountPercent(product.priceMinor, product.compareAtMinor);
  const cardStyles: React.CSSProperties =
    cardStyle === "bordered"
      ? { border: "var(--sf-border-width) solid var(--sf-border)", borderRadius: "var(--sf-radius)", padding: 12 }
      : cardStyle === "elevated"
        ? { background: "var(--sf-surface)", borderRadius: "var(--sf-radius)", padding: 12, boxShadow: "0 1px 3px rgb(0 0 0 / 0.07)" }
        : {};

  return (
    <a
      href={ctx.editing ? undefined : linkTo(ctx, `/p/${product.slug}`)}
      style={{ textDecoration: "none", color: "inherit", display: "block", ...cardStyles }}
    >
      <div style={{ position: "relative" }}>
        <ImageSlot url={product.imageUrl} alt={product.name} ratio={ratio} />
        {off ? (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: "var(--sf-accent)",
              color: "var(--sf-on-primary)",
              fontFamily: "var(--sf-font-body)",
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: "var(--sf-button-radius)",
            }}
          >
            {off}% off
          </span>
        ) : null}
        {product.soldOut ? (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "color-mix(in srgb, var(--sf-bg) 66%, transparent)",
              fontFamily: "var(--sf-font-body)",
              fontSize: "0.8rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              borderRadius: "var(--sf-radius)",
            }}
          >
            Sold out
          </span>
        ) : null}
      </div>

      <p style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.93rem", marginTop: 12, marginBottom: 0 }}>
        {product.name}
      </p>

      {showPrice ? (
        <p style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.9rem", color: "var(--sf-muted)", marginTop: 4, display: "flex", gap: 8 }}>
          <span style={{ color: "var(--sf-text)" }}>{formatMoney(product.priceMinor, product.currency)}</span>
          {off ? (
            <s style={{ opacity: 0.6 }}>{formatMoney(product.compareAtMinor!, product.currency)}</s>
          ) : null}
        </p>
      ) : null}
    </a>
  );
}

/*
 * A catalogue with nothing in it.
 *
 * In the builder this shows ghost tiles, so the merchant can see the layout
 * they are designing before they have photographed anything. On a live
 * storefront it says so plainly rather than rendering an empty band.
 */
function EmptyCatalogue({ editing, columns, ratio }: { editing: boolean; columns: number; ratio: string }) {
  if (editing) {
    return (
      <div className="grid gap-x-5 gap-y-9" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${columns >= 4 ? 200 : 240}px, 1fr))` }}>
        {Array.from({ length: columns }, (_, i) => (
          <div key={i}>
            <ImageSlot url={null} alt="" ratio={ratio} />
            <div style={{ height: 10, width: "60%", background: "var(--sf-border)", borderRadius: 4, marginTop: 12 }} />
            <div style={{ height: 10, width: "35%", background: "var(--sf-border)", borderRadius: 4, marginTop: 6, opacity: 0.6 }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <p style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)", textAlign: "center", padding: "40px 0" }}>
      Nothing here just yet. Check back soon.
    </p>
  );
}
