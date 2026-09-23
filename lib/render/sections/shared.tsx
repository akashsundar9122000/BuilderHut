import { z } from "zod";
import type { RenderContext } from "../context";

/*
 * Shared prop fragments and primitives for storefront sections.
 *
 * Everything here reads --sf-* custom properties, never BuilderHut's own
 * tokens. A storefront that inherited the dashboard's palette would defeat the
 * product: a bakery and a streetwear label have to be able to look unrelated.
 */

export const AlignSchema = z.enum(["left", "center"]).default("left");
export const ToneSchema = z.enum(["page", "surface", "raised", "primary"]).default("page");

export const toneStyles: Record<string, React.CSSProperties> = {
  page: { background: "var(--sf-bg)", color: "var(--sf-text)" },
  surface: { background: "var(--sf-surface)", color: "var(--sf-text)" },
  raised: { background: "var(--sf-raised)", color: "var(--sf-text)" },
  primary: { background: "var(--sf-primary)", color: "var(--sf-on-primary)" },
};

export function SectionShell({
  tone = "page",
  children,
  flush = false,
}: {
  tone?: string;
  children: React.ReactNode;
  /** Hero and banner sections manage their own vertical rhythm. */
  flush?: boolean;
}) {
  return (
    <section
      style={{
        ...toneStyles[tone],
        paddingTop: flush ? 0 : "var(--sf-section-y)",
        paddingBottom: flush ? 0 : "var(--sf-section-y)",
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

export function Heading({
  level = 2,
  children,
  align = "left",
  size = "lg",
}: {
  level?: 1 | 2 | 3;
  children: React.ReactNode;
  align?: string;
  size?: "sm" | "lg" | "xl";
}) {
  const Tag = `h${level}` as "h1" | "h2" | "h3";
  const sizes = {
    sm: "clamp(1.25rem, 1.05rem + 0.9vw, 1.6rem)",
    lg: "clamp(1.7rem, 1.3rem + 1.8vw, 2.6rem)",
    xl: "clamp(2.3rem, 1.5rem + 3.6vw, 4.2rem)",
  };
  return (
    <Tag
      style={{
        fontFamily: "var(--sf-font-heading)",
        fontWeight: "var(--sf-heading-weight)" as unknown as number,
        letterSpacing: "var(--sf-heading-tracking)",
        textTransform: "var(--sf-heading-transform)" as React.CSSProperties["textTransform"],
        fontSize: `calc(${sizes[size]} * var(--sf-scale))`,
        lineHeight: 1.1,
        textAlign: align === "center" ? "center" : "left",
        textWrap: "balance",
        margin: 0,
      }}
    >
      {children}
    </Tag>
  );
}

export function Lede({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: string;
}) {
  return (
    <p
      style={{
        fontFamily: "var(--sf-font-body)",
        color: "var(--sf-muted)",
        fontSize: "calc(1rem * var(--sf-scale))",
        lineHeight: 1.65,
        maxWidth: "46ch",
        marginInline: align === "center" ? "auto" : undefined,
        textAlign: align === "center" ? "center" : "left",
        textWrap: "pretty",
      }}
    >
      {children}
    </p>
  );
}

export function StoreButton({
  href,
  children,
  variant = "primary",
  ctx,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "outline";
  ctx: RenderContext;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "0 22px",
    borderRadius: "var(--sf-button-radius)",
    fontFamily: "var(--sf-font-body)",
    fontSize: "0.95rem",
    fontWeight: 500,
    textDecoration: "none",
    transition: "transform 150ms, opacity 150ms",
  };
  const style: React.CSSProperties =
    variant === "primary"
      ? { ...base, background: "var(--sf-primary)", color: "var(--sf-on-primary)" }
      : {
          ...base,
          background: "transparent",
          color: "var(--sf-text)",
          border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
        };

  // Inside the builder canvas a link must not navigate away from the editor.
  if (ctx.editing) {
    return (
      <span style={style} role="button" tabIndex={-1}>
        {children}
      </span>
    );
  }
  return (
    <a href={href} style={style}>
      {children}
    </a>
  );
}

/*
 * What a section with no content yet shows IN THE BUILDER.
 *
 * On a live storefront an empty FAQ or testimonial band renders nothing — a
 * customer should not see a heading over blank space. But in the editor,
 * returning null means adding the section from the library appears to do
 * nothing at all, and the merchant has no idea where it went or how to fill it.
 * So the editor gets a prompt and the storefront gets silence.
 */
export function EmptySectionHint({ label, ctx }: { label: string; ctx: RenderContext }) {
  if (!ctx.editing) return null;
  return (
    <SectionShell>
      <div
        style={{
          border: "1px dashed var(--sf-border)",
          borderRadius: "var(--sf-radius)",
          padding: "40px 24px",
          textAlign: "center",
          fontFamily: "var(--sf-font-body)",
          color: "var(--sf-muted)",
          fontSize: "0.9rem",
        }}
      >
        {label}
      </div>
    </SectionShell>
  );
}

/** A placeholder that looks composed rather than broken when no image is set. */
export function ImageSlot({
  url,
  alt,
  ratio = "1 / 1",
  rounded = true,
}: {
  url?: string | null;
  alt: string;
  ratio?: string;
  rounded?: boolean;
}) {
  const style: React.CSSProperties = {
    aspectRatio: ratio,
    width: "100%",
    borderRadius: rounded ? "var(--sf-radius)" : 0,
    overflow: "hidden",
    background: "var(--sf-raised)",
    border: "var(--sf-border-width) solid var(--sf-border)",
    objectFit: "cover",
    display: "block",
  };
  if (!url) return <div style={style} aria-hidden="true" />;
  /*
   * A plain <img>, not next/image. Merchant media is already served from our
   * own /media route, content-addressed and immutably cached, so next/image
   * would add a second optimisation hop over bytes we control — and it cannot
   * know the intrinsic dimensions of an arbitrary merchant upload anyway.
   * Resizing and WebP/AVIF variants belong in the media pipeline, where the
   * result can be cached once rather than per render.
   */
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} style={style} loading="lazy" decoding="async" />;
}
