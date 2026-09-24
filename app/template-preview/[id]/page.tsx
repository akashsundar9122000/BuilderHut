import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { sampleProducts } from "@/lib/marketing/sample-products";
import { RenderPage } from "@/lib/render/render";
import { STOREFRONT_FONT_VARS } from "@/lib/render/fonts";
import { themeToCss } from "@/lib/render/theme-css";
import { homePage } from "@/lib/schema/page";
import { buildDocument, getTemplate, TEMPLATES } from "@/lib/templates";

/*
 * A template rendered on its own, for the iframe on /templates/[id].
 *
 * ── Why this is a route and not a component ───────────────────────────────
 *
 * The preview has a desktop/tablet/phone toggle, and the first version did it
 * by narrowing a container. That does not work and — worse — it looked like it
 * did: the storefront's own layout responds to the VIEWPORT, so narrowing a box
 * inside a 1440px window gives a squeezed desktop page, not the phone one. The
 * hero type stayed at its desktop size and ran off the edge, and the toggle was
 * quietly showing people a broken version of a template that is fine.
 *
 * An iframe has a viewport of its own, so the media queries and vw units
 * resolve against the width the toggle picked and the phone layout is really
 * the phone layout. Which means this needs to be a document.
 *
 * Deliberately outside the (marketing) route group: a layout nested under that
 * one would inherit its header and footer, and a shop with BuilderHut's own
 * chrome bolted on top is not what the merchant's customers will see.
 */

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

export const metadata: Metadata = {
  // The page a person is meant to find is /templates/[id]. This is its innards.
  robots: { index: false, follow: false },
};

export default async function TemplateFrame({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) notFound();

  const doc = buildDocument(template.id, {
    storeName: template.name,
    tagline: template.blurb,
    industry: template.industries[0] ?? "other",
  });

  return (
    <div
      data-storefront=""
      className={STOREFRONT_FONT_VARS}
      style={{
        background: "var(--sf-bg)",
        color: "var(--sf-text)",
        fontFamily: "var(--sf-font-body)",
        minHeight: "100dvh",
        // The template brings its own; BuilderHut's data-theme must not reach
        // in and repaint it.
        colorScheme: "light dark",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: themeToCss(doc.theme) }} />
      {/*
       * `editing: true` — the same flag the builder canvas uses. It suppresses
       * navigation and real form posts, which is exactly right here: there is
       * no shop behind this, so "Shop now" must not walk somebody into a 404
       * in the middle of judging a design.
       */}
      <RenderPage
        page={homePage(doc)}
        ctx={{ doc, base: "", products: sampleProducts(template.industries), editing: true }}
      />
    </div>
  );
}
