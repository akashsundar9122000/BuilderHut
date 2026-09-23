import { RenderSection } from "@/lib/render/render";
import type { RenderContext } from "@/lib/render/context";
import type { Page } from "@/lib/schema/page";

/*
 * Header and footer for the pages the builder does not lay out — cart,
 * checkout, order confirmation, product detail.
 *
 * They reuse the merchant's own header and footer sections from the home page,
 * so a shop's chrome is consistent across every page whether or not the builder
 * owns that page's body. Anything else would make the checkout look like it
 * belonged to a different shop, which is exactly where trust matters most.
 */

function chromeFrom(page: Page, type: "header" | "footer") {
  return page.sections.find((section) => section.type === type) ?? null;
}

export function StoreHeader({ page, ctx }: { page: Page; ctx: RenderContext }) {
  const section = chromeFrom(page, "header");
  return section ? <RenderSection section={section} ctx={ctx} /> : null;
}

export function StoreFooter({ page, ctx }: { page: Page; ctx: RenderContext }) {
  const section = chromeFrom(page, "footer");
  return section ? <RenderSection section={section} ctx={ctx} /> : null;
}

/** A page body that the builder does not own, in the merchant's own styling. */
export function StorePageShell({
  title,
  lede,
  children,
  wide = false,
}: {
  title: string;
  lede?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      style={{
        paddingTop: "calc(var(--sf-section-y) * 0.7)",
        paddingBottom: "var(--sf-section-y)",
        // Takes the slack in the layout's column, so the footer is pushed down.
        flex: 1,
      }}
    >
      <div
        className="mx-auto w-full px-5 sm:px-8"
        style={{ maxWidth: wide ? "72rem" : "48rem" }}
      >
        <h1
          style={{
            fontFamily: "var(--sf-font-heading)",
            fontWeight: "var(--sf-heading-weight)" as unknown as number,
            letterSpacing: "var(--sf-heading-tracking)",
            textTransform: "var(--sf-heading-transform)" as React.CSSProperties["textTransform"],
            fontSize: "calc(clamp(1.7rem, 1.3rem + 1.6vw, 2.4rem) * var(--sf-scale))",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {lede ? (
          <p
            style={{
              fontFamily: "var(--sf-font-body)",
              color: "var(--sf-muted)",
              fontSize: "0.95rem",
              marginTop: 10,
            }}
          >
            {lede}
          </p>
        ) : null}
        <div style={{ marginTop: 32 }}>{children}</div>
      </div>
    </main>
  );
}
