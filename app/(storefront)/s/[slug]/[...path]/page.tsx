import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RenderPage } from "@/lib/render/render";
import { findPage, ROUTED_SYSTEM_PAGES } from "@/lib/schema/page";
import { loadStorefront, renderContextFor } from "@/lib/stores/storefront";
import { after } from "next/server";
import { track, trackContext } from "@/lib/analytics/track";

/*
 * Every non-home page of a storefront: /about, /shop, /shipping-policy and any
 * page the merchant adds in the builder.
 *
 * The path is looked up in the document rather than mapped to a file, which is
 * what lets a merchant create a page without a deploy.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}): Promise<Metadata> {
  const { slug, path } = await params;
  const store = await loadStorefront(slug);
  const page = store ? findPage(store.doc, path.join("/")) : undefined;
  if (!store || !page) return { title: "Page not found" };

  return {
    title: { absolute: page.seo.title || `${page.title} · ${store.storeName}` },
    description: page.seo.description || undefined,
    robots: page.seo.noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}) {
  const { slug, path } = await params;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  const page = findPage(store.doc, path.join("/"));
  if (!page || page.hidden) notFound();

  /*
   * A system page with a route of its own is never served from here. Static
   * segments beat the catch-all so this should be unreachable, but if it ever were
   * reached — a slug collision, a route removed later — it would render a sign-in
   * form with no session, policy or action behind it: a dead form on a live shop.
   */
  if (page.system && (ROUTED_SYSTEM_PAGES as readonly string[]).includes(page.system)) {
    notFound();
  }

  const measured = await trackContext();
  after(() =>
    track(store.tenantId, "page_view", measured, { path: `/${path.join("/")}` }),
  );

  return <RenderPage page={page} ctx={renderContextFor(store)} />;
}
