import { z } from "zod";
import { safeHref } from "@/lib/schema/page";
import { linkTo, type RenderContext } from "../context";
import { ToneSchema, toneStyles } from "./shared";

/* Header and footer: the chrome every page of a storefront carries. */

export const HeaderProps = z.object({
  showSearch: z.boolean().default(true),
  showCart: z.boolean().default(true),
  showAccount: z.boolean().default(true),
  announcement: z.string().max(120).default(""),
  sticky: z.boolean().default(true),
  tone: ToneSchema,
});

export function Header({
  props,
  ctx,
}: {
  props: z.infer<typeof HeaderProps>;
  ctx: RenderContext;
}) {
  const { settings } = ctx.doc;
  return (
    <header
      style={{
        ...toneStyles[props.tone],
        position: props.sticky && !ctx.editing ? "sticky" : "relative",
        top: 0,
        zIndex: 30,
        borderBottom: "var(--sf-border-width) solid var(--sf-border)",
      }}
    >
      {props.announcement ? (
        <div
          style={{
            background: "var(--sf-primary)",
            color: "var(--sf-on-primary)",
            fontFamily: "var(--sf-font-body)",
            fontSize: "0.8rem",
            textAlign: "center",
            padding: "8px 16px",
          }}
        >
          {props.announcement}
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-4 sm:px-8">
        <a
          href={ctx.editing ? undefined : linkTo(ctx, "/")}
          style={{
            fontFamily: "var(--sf-font-heading)",
            fontWeight: "var(--sf-heading-weight)" as unknown as number,
            letterSpacing: "var(--sf-heading-tracking)",
            textTransform: "var(--sf-heading-transform)" as React.CSSProperties["textTransform"],
            fontSize: "calc(1.15rem * var(--sf-scale))",
            color: "inherit",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          {settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={settings.storeName} style={{ height: 30 }} />
          ) : (
            settings.storeName
          )}
        </a>

        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {ctx.doc.nav.map((item) => (
            <a
              key={item.id}
              href={ctx.editing ? undefined : linkTo(ctx, safeHref(item.href))}
              style={{
                fontFamily: "var(--sf-font-body)",
                fontSize: "0.9rem",
                color: "inherit",
                opacity: 0.85,
                textDecoration: "none",
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          {props.showSearch ? (
            <IconGlyph label="Search" d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35" />
          ) : null}
          {props.showAccount ? (
            <IconGlyph label="Account" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          ) : null}
          {props.showCart ? (
            // The one icon that has to work. In the builder it is inert, so
            // clicking it does not navigate the merchant out of the editor.
            <IconGlyph
              label="Basket"
              d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6ZM3 6h18M16 10a4 4 0 0 1-8 0"
              href={ctx.editing ? undefined : linkTo(ctx, "/cart")}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** Inline SVG so a storefront never loads an icon font or a script for chrome. */
function IconGlyph({ label, d, href }: { label: string; d: string; href?: string }) {
  const glyph = (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );

  if (href) {
    return (
      <a
        href={href}
        aria-label={label}
        // 44px hit area on touch without changing the visual size.
        style={{ display: "inline-flex", padding: 12, margin: -12, color: "inherit", opacity: 0.8 }}
      >
        {glyph}
      </a>
    );
  }
  return (
    <span aria-label={label} role="img" style={{ display: "inline-flex", opacity: 0.8 }}>
      {glyph}
    </span>
  );
}

export const FooterProps = z.object({
  blurb: z.string().max(240).default(""),
  showSocials: z.boolean().default(true),
  tone: ToneSchema.default("raised"),
});

export function Footer({
  props,
  ctx,
}: {
  props: z.infer<typeof FooterProps>;
  ctx: RenderContext;
}) {
  const { settings, footerNav } = ctx.doc;
  const socials = [
    settings.socials.instagram && { label: "Instagram", href: settings.socials.instagram },
    settings.socials.whatsapp && { label: "WhatsApp", href: `https://wa.me/${settings.socials.whatsapp.replace(/\D/g, "")}` },
    settings.socials.email && { label: "Email", href: `mailto:${settings.socials.email}` },
    settings.socials.phone && { label: "Phone", href: `tel:${settings.socials.phone}` },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer
      style={{
        ...toneStyles[props.tone],
        borderTop: "var(--sf-border-width) solid var(--sf-border)",
        paddingTop: "calc(var(--sf-section-y) * 0.8)",
        paddingBottom: "calc(var(--sf-section-y) * 0.5)",
      }}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div style={{ maxWidth: "32ch" }}>
            <p
              style={{
                fontFamily: "var(--sf-font-heading)",
                fontWeight: "var(--sf-heading-weight)" as unknown as number,
                letterSpacing: "var(--sf-heading-tracking)",
                textTransform: "var(--sf-heading-transform)" as React.CSSProperties["textTransform"],
                fontSize: "calc(1.15rem * var(--sf-scale))",
                margin: 0,
              }}
            >
              {settings.storeName}
            </p>
            {props.blurb ? (
              <p style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)", fontSize: "0.9rem", lineHeight: 1.6, marginTop: 10 }}>
                {props.blurb}
              </p>
            ) : null}
          </div>

          {footerNav.length > 0 ? (
            <nav className="flex flex-col gap-2.5">
              {footerNav.map((item) => (
                <a
                  key={item.id}
                  href={ctx.editing ? undefined : linkTo(ctx, safeHref(item.href))}
                  style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.88rem", color: "var(--sf-muted)", textDecoration: "none" }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}

          {props.showSocials && socials.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={ctx.editing ? undefined : safeHref(s.href)}
                  style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.88rem", color: "var(--sf-muted)", textDecoration: "none" }}
                >
                  {s.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <p
          style={{
            fontFamily: "var(--sf-font-body)",
            fontSize: "0.78rem",
            color: "var(--sf-muted)",
            opacity: 0.8,
            marginTop: 40,
          }}
        >
          © {new Date().getFullYear()} {settings.storeName}
        </p>
      </div>
    </footer>
  );
}
