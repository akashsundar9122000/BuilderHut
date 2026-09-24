import { redirect } from "next/navigation";

import { requireActor } from "@/lib/auth/session";
import { loadDraft } from "@/lib/builder/service";
import { RenderPage } from "@/lib/render/render";
import { findPage, homePage } from "@/lib/schema/page";
import { loadStorefrontProducts } from "@/lib/stores/storefront";

/*
 * Any page of the draft, rendered as a customer would get it.
 *
 * An optional catch-all rather than two routes, so the links inside the
 * preview work: base is "/app/builder/preview", so the header's "Shop" goes to
 * /app/builder/preview/shop and stays in the draft instead of jumping to the
 * published store halfway through a look around.
 *
 * `editing: false` on purpose. The canvas already shows the editing view; the
 * whole point of this one is to see the real thing, links and all.
 */

export const PREVIEW_BASE = "/app/builder/preview";

export default async function DraftPreview({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const actor = await requireActor();
  if (!actor.tenantId) redirect("/onboarding");

  const draft = await loadDraft();
  if (!draft) redirect("/app");

  const slug = (path ?? []).join("/");
  const page = slug ? findPage(draft.doc, slug) : homePage(draft.doc);
  const products = await loadStorefrontProducts(actor.tenantId, "INR");

  /*
   * A path the draft has no page for.
   *
   * These are reachable: a storefront's header links to /cart and its product
   * cards to /p/<slug>, and neither is a page in the document — they are real
   * routes that only exist on a published store. Calling notFound() here would
   * drop the merchant onto BuilderHut's own 404 in the middle of what is meant
   * to be their shop, so this says what happened instead.
   */
  if (!page) {
    return (
      <main style={{ margin: "auto", padding: "80px 24px", textAlign: "center", maxWidth: 480 }}>
        <p style={{ fontFamily: "var(--sf-font-heading)", fontSize: "1.4rem", margin: 0 }}>
          Not part of your draft
        </p>
        <p style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)", lineHeight: 1.6 }}>
          Baskets, checkout and product pages are built for you and only run on your published
          store. Everything you design in the builder is here.
        </p>
        <a
          href={PREVIEW_BASE}
          style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-accent)" }}
        >
          Back to the home page
        </a>
      </main>
    );
  }

  return (
    <RenderPage
      page={page}
      ctx={{ doc: draft.doc, base: PREVIEW_BASE, products, editing: false }}
    />
  );
}
