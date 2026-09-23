import { z } from "zod";
import { safeHref } from "@/lib/schema/page";
import type { RenderContext } from "../context";
import { AlignSchema, EmptySectionHint, Heading, Lede, SectionShell, StoreButton, ToneSchema } from "./shared";

/* Trust, questions and contact: the sections that answer "should I buy from you". */

export const TestimonialsProps = z.object({
  heading: z.string().max(120).default("What people say"),
  items: z
    .array(z.object({ quote: z.string().max(320), name: z.string().max(60), detail: z.string().max(60).default("") }))
    .max(9)
    .default([]),
  layout: z.enum(["grid", "single"]).default("grid"),
  tone: ToneSchema,
});

export function Testimonials({
  props,
  ctx,
}: {
  props: z.infer<typeof TestimonialsProps>;
  ctx: RenderContext;
}) {
  if (props.items.length === 0) {
    return <EmptySectionHint label="Add a quote in the panel on the right." ctx={ctx} />;
  }

  if (props.layout === "single") {
    const first = props.items[0]!;
    return (
      <SectionShell tone={props.tone}>
        <figure className="mx-auto max-w-2xl text-center">
          <blockquote
            style={{
              fontFamily: "var(--sf-font-heading)",
              fontSize: "calc(1.4rem * var(--sf-scale))",
              lineHeight: 1.45,
              letterSpacing: "var(--sf-heading-tracking)",
              margin: 0,
              textWrap: "balance",
            }}
          >
            &ldquo;{first.quote}&rdquo;
          </blockquote>
          <figcaption style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)", fontSize: "0.88rem", marginTop: 20 }}>
            {first.name}
            {first.detail ? ` · ${first.detail}` : ""}
          </figcaption>
        </figure>
      </SectionShell>
    );
  }

  return (
    <SectionShell tone={props.tone}>
      {props.heading ? (
        <div className="mb-10">
          <Heading>{props.heading}</Heading>
        </div>
      ) : null}
      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {props.items.map((item, i) => (
          <figure key={i} style={{ margin: 0, borderTop: "var(--sf-border-width) solid var(--sf-border)", paddingTop: 18 }}>
            <blockquote style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.95rem", lineHeight: 1.7, margin: 0 }}>
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <figcaption style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)", fontSize: "0.82rem", marginTop: 14 }}>
              {item.name}
              {item.detail ? ` · ${item.detail}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>
    </SectionShell>
  );
}

export const FaqProps = z.object({
  heading: z.string().max(120).default("Questions"),
  items: z.array(z.object({ question: z.string().max(160), answer: z.string().max(800) })).max(20).default([]),
  tone: ToneSchema,
});

export function Faq({ props, ctx }: { props: z.infer<typeof FaqProps>; ctx: RenderContext }) {
  if (props.items.length === 0) {
    return <EmptySectionHint label="Add a question in the panel on the right." ctx={ctx} />;
  }
  return (
    <SectionShell tone={props.tone}>
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Heading>{props.heading}</Heading>
        <div>
          {props.items.map((item, i) => (
            // <details> gives an accordion that works with no JavaScript at all,
            // which matters on a storefront budgeted to ship almost none.
            <details
              key={i}
              style={{ borderBottom: "var(--sf-border-width) solid var(--sf-border)", padding: "16px 0" }}
            >
              <summary
                style={{
                  fontFamily: "var(--sf-font-body)",
                  fontSize: "0.98rem",
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                {item.question}
                <span aria-hidden="true" style={{ color: "var(--sf-muted)" }}>+</span>
              </summary>
              <p style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)", fontSize: "0.93rem", lineHeight: 1.7, marginTop: 12, marginBottom: 0 }}>
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}

export const NewsletterProps = z.object({
  heading: z.string().max(120).default("Stay in the loop"),
  body: z.string().max(240).default("New pieces, restocks and the occasional discount."),
  buttonLabel: z.string().max(30).default("Subscribe"),
  align: AlignSchema.default("center"),
  tone: ToneSchema.default("raised"),
});

export function Newsletter({ props, ctx }: { props: z.infer<typeof NewsletterProps>; ctx: RenderContext }) {
  return (
    <SectionShell tone={props.tone}>
      <div className="mx-auto flex max-w-xl flex-col gap-4" style={{ alignItems: props.align === "center" ? "center" : undefined }}>
        <Heading align={props.align} size="sm">
          {props.heading}
        </Heading>
        {props.body ? <Lede align={props.align}>{props.body}</Lede> : null}
        <form
          className="mt-2 flex w-full flex-col gap-2 sm:flex-row"
          // Subscriptions are wired up in Phase 7 marketing. Until then the form
          // is inert rather than silently discarding an address.
          onSubmit={undefined}
          action={ctx.editing ? undefined : "#"}
        >
          <input
            type="email"
            placeholder="you@example.com"
            aria-label="Email address"
            disabled={ctx.editing}
            style={{
              flex: 1,
              minHeight: 46,
              padding: "0 14px",
              fontFamily: "var(--sf-font-body)",
              fontSize: "max(16px, 0.95rem)",
              color: "var(--sf-text)",
              background: "var(--sf-surface)",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              borderRadius: "var(--sf-button-radius)",
            }}
          />
          <StoreButton href="#" ctx={ctx}>
            {props.buttonLabel}
          </StoreButton>
        </form>
      </div>
    </SectionShell>
  );
}

export const ContactProps = z.object({
  heading: z.string().max(120).default("Get in touch"),
  body: z.string().max(280).default(""),
  showWhatsapp: z.boolean().default(true),
  showEmail: z.boolean().default(true),
  showInstagram: z.boolean().default(true),
  align: AlignSchema.default("center"),
  tone: ToneSchema,
});

export function Contact({ props, ctx }: { props: z.infer<typeof ContactProps>; ctx: RenderContext }) {
  const s = ctx.doc.settings.socials;
  /*
   * These are the buttons this audience actually converts on. A crochet seller
   * in Chennai takes custom orders over WhatsApp, not through a contact form,
   * and blueprint section 28 asks for them to be first-class — including
   * tracking the clicks separately, which lands with analytics in Phase 5.
   */
  const links = [
    props.showWhatsapp && s.whatsapp && { label: "Message on WhatsApp", href: `https://wa.me/${s.whatsapp.replace(/\D/g, "")}` },
    props.showInstagram && s.instagram && { label: "Instagram", href: s.instagram },
    props.showEmail && s.email && { label: "Email us", href: `mailto:${s.email}` },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <SectionShell tone={props.tone}>
      <div className="mx-auto flex max-w-xl flex-col gap-4" style={{ alignItems: props.align === "center" ? "center" : undefined }}>
        <Heading align={props.align}>{props.heading}</Heading>
        {props.body ? <Lede align={props.align}>{props.body}</Lede> : null}
        {links.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-3" style={{ justifyContent: props.align === "center" ? "center" : undefined }}>
            {links.map((link, i) => (
              <StoreButton key={link.label} href={safeHref(link.href)} variant={i === 0 ? "primary" : "outline"} ctx={ctx}>
                {link.label}
              </StoreButton>
            ))}
          </div>
        ) : null}
      </div>
    </SectionShell>
  );
}
