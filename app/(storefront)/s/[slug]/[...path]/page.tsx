import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RenderPage } from "@/lib/render/render";
import { findPage } from "@/lib/schema/page";
import { loadStorefront } from "@/lib/stores/storefront";

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

  return (
    <RenderPage
      page={page}
      ctx={{ doc: store.doc, base: `/s/${store.slug}`, products: store.products, editing: false }}
    />
  );
}
