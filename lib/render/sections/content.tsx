import { z } from "zod";
import { safeHref } from "@/lib/schema/page";
import { linkTo, type RenderContext } from "../context";
import { AlignSchema, Heading, ImageSlot, Lede, SectionShell, StoreButton, ToneSchema, toneStyles } from "./shared";

/* Editorial sections: the parts that carry a brand's voice rather than its catalogue. */

export const HeroProps = z.object({
  eyebrow: z.string().max(60).default(""),
  heading: z.string().max(120).default("Made by hand"),
  body: z.string().max(280).default(""),
  ctaLabel: z.string().max(30).default("Shop the collection"),
  ctaHref: z.string().max(400).default("/shop"),
  secondaryLabel: z.string().max(30).default(""),
  secondaryHref: z.string().max(400).default(""),
  imageUrl: z.string().max(400).nullable().default(null),
  /** split = image beside copy; stacked = centred copy over full-width image. */
  layout: z.enum(["split", "stacked", "minimal"]).default("split"),
  align: AlignSchema,
  tone: ToneSchema,
  height: z.enum(["compact", "tall", "full"]).default("tall"),
});

export function Hero({ props, ctx }: { props: z.infer<typeof HeroProps>; ctx: RenderContext }) {
  const minHeight = { compact: "auto", tall: "min(78vh, 720px)", full: "100vh" }[props.height];

  const copy = (
    <div className="flex flex-col gap-5" style={{ alignItems: props.align === "center" ? "center" : undefined }}>
      {props.eyebrow ? (
        <p
          style={{
            fontFamily: "var(--sf-font-body)",
            fontSize: "0.72rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--sf-accent)",
            margin: 0,
          }}
        >
          {props.eyebrow}
        </p>
      ) : null}
      <Heading level={1} size="xl" align={props.align}>
        {props.heading}
      </Heading>
      {props.body ? <Lede align={props.align}>{props.body}</Lede> : null}
      <div className="mt-2 flex flex-wrap gap-3" style={{ justifyContent: props.align === "center" ? "center" : undefined }}>
        {props.ctaLabel ? (
          <StoreButton href={linkTo(ctx, safeHref(props.ctaHref))} ctx={ctx}>
            {props.ctaLabel}
          </StoreButton>
        ) : null}
        {props.secondaryLabel ? (
          <StoreButton href={linkTo(ctx, safeHref(props.secondaryHref))} variant="outline" ctx={ctx}>
            {props.secondaryLabel}
          </StoreButton>
        ) : null}
      </div>
    </div>
  );

  if (props.layout === "stacked") {
    return (
      <section style={{ ...toneStyles[props.tone], position: "relative", minHeight, display: "grid", placeItems: "center", overflow: "hidden" }}>
        {props.imageUrl ? (
          <div style={{ position: "absolute", inset: 0 }}>
            <ImageSlot url={props.imageUrl} alt="" ratio="auto" rounded={false} />
            <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--sf-bg) 55%, transparent)" }} />
          </div>
        ) : null}
        <div className="relative mx-auto w-full max-w-3xl px-5 py-24 text-center sm:px-8">{copy}</div>
      </section>
    );
  }

  if (props.layout === "minimal") {
    return (
      <SectionShell tone={props.tone}>
        <div className="mx-auto max-w-3xl py-10">{copy}</div>
      </SectionShell>
    );
  }

  return (
    <section style={{ ...toneStyles[props.tone], minHeight, display: "flex", alignItems: "center" }}>
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 md:gap-14">
        <div>{copy}</div>
        <div className="order-first md:order-last">
          <ImageSlot url={props.imageUrl} alt={props.heading} ratio="4 / 5" />
        </div>
      </div>
    </section>
  );
}

export const RichTextProps = z.object({
  eyebrow: z.string().max(60).default(""),
  heading: z.string().max(120).default(""),
  body: z.string().max(1200).default(""),
  align: AlignSchema,
  tone: ToneSchema,
  maxWidth: z.enum(["narrow", "wide"]).default("narrow"),
});

export function RichText({ props }: { props: z.infer<typeof RichTextProps>; ctx: RenderContext }) {
  return (
    <SectionShell tone={props.tone}>
      <div
        style={{
          maxWidth: props.maxWidth === "narrow" ? "60ch" : "100%",
          marginInline: props.align === "center" ? "auto" : undefined,
        }}
        className="flex flex-col gap-4"
      >
        {props.eyebrow ? (
          <p style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--sf-accent)", margin: 0, textAlign: props.align === "center" ? "center" : "left" }}>
            {props.eyebrow}
          </p>
        ) : null}
        {props.heading ? <Heading align={props.align}>{props.heading}</Heading> : null}
        {/*
          Split on blank lines into paragraphs rather than rendering HTML.
          Merchant text is data: interpolating it as markup would be a stored
          XSS hole on a page we serve to the public.
        */}
        {props.body
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((para, i) => (
            <p
              key={i}
              style={{
                fontFamily: "var(--sf-font-body)",
                color: "var(--sf-muted)",
                fontSize: "calc(1rem * var(--sf-scale))",
                lineHeight: 1.75,
                textAlign: props.align === "center" ? "center" : "left",
                textWrap: "pretty",
                margin: 0,
              }}
            >
              {para}
            </p>
          ))}
      </div>
    </SectionShell>
  );
}

export const FeatureListProps = z.object({
  heading: z.string().max(120).default(""),
  items: z
    .array(z.object({ title: z.string().max(60), body: z.string().max(200) }))
    .max(6)
    .default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  align: AlignSchema,
  tone: ToneSchema,
});

export function FeatureList({ props }: { props: z.infer<typeof FeatureListProps>; ctx: RenderContext }) {
  return (
    <SectionShell tone={props.tone}>
      {props.heading ? (
        <div className="mb-10">
          <Heading align={props.align}>{props.heading}</Heading>
        </div>
      ) : null}
      <div
        className="grid gap-8"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${props.columns >= 4 ? 200 : 240}px, 1fr))` }}
      >
        {props.items.map((item, i) => (
          <div key={i} style={{ textAlign: props.align === "center" ? "center" : "left" }}>
            <p style={{ fontFamily: "var(--sf-font-heading)", fontSize: "calc(1.05rem * var(--sf-scale))", fontWeight: "var(--sf-heading-weight)" as unknown as number, margin: 0 }}>
              {item.title}
            </p>
            <p style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)", fontSize: "0.92rem", lineHeight: 1.65, marginTop: 8 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

export const ImageBannerProps = z.object({
  heading: z.string().max(120).default(""),
  body: z.string().max(280).default(""),
  ctaLabel: z.string().max(30).default(""),
  ctaHref: z.string().max(400).default("/shop"),
  imageUrl: z.string().max(400).nullable().default(null),
  imageSide: z.enum(["left", "right"]).default("left"),
  tone: ToneSchema,
});

export function ImageBanner({ props, ctx }: { props: z.infer<typeof ImageBannerProps>; ctx: RenderContext }) {
  return (
    <SectionShell tone={props.tone}>
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className={props.imageSide === "right" ? "md:order-last" : undefined}>
          <ImageSlot url={props.imageUrl} alt={props.heading} ratio="3 / 2" />
        </div>
        <div className="flex flex-col gap-4">
          {props.heading ? <Heading>{props.heading}</Heading> : null}
          {props.body ? <Lede>{props.body}</Lede> : null}
          {props.ctaLabel ? (
            <div className="mt-2">
              <StoreButton href={linkTo(ctx, safeHref(props.ctaHref))} variant="outline" ctx={ctx}>
                {props.ctaLabel}
              </StoreButton>
            </div>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}

export const GalleryProps = z.object({
  heading: z.string().max(120).default(""),
  images: z.array(z.object({ url: z.string().max(400), alt: z.string().max(140).default("") })).max(12).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
  tone: ToneSchema,
});

export function Gallery({ props }: { props: z.infer<typeof GalleryProps>; ctx: RenderContext }) {
  // An empty gallery renders placeholder tiles rather than collapsing, so the
  // section still reads as a designed band before the merchant adds photos.
  const tiles = props.images.length > 0 ? props.images : Array.from({ length: props.columns }, () => ({ url: "", alt: "" }));
  return (
    <SectionShell tone={props.tone}>
      {props.heading ? (
        <div className="mb-8">
          <Heading size="sm">{props.heading}</Heading>
        </div>
      ) : null}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${props.columns >= 4 ? 160 : 220}px, 1fr))` }}>
        {tiles.map((img, i) => (
          <ImageSlot key={i} url={img.url || null} alt={img.alt} />
        ))}
      </div>
    </SectionShell>
  );
}
