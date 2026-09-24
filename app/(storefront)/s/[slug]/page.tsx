import { notFound } from "next/navigation";

import { RenderPage } from "@/lib/render/render";
import { homePage } from "@/lib/schema/page";
import { loadStorefront, renderContextFor } from "@/lib/stores/storefront";
import { after } from "next/server";
import { track, trackContext } from "@/lib/analytics/track";

export default async function StorefrontHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  // The request context is read here; the write is deferred with after(), so
  // measuring a visit never slows the visit down.
  const measured = await trackContext();
  after(() => track(store.tenantId, "page_view", measured, { path: "/" }));

  return <RenderPage page={homePage(store.doc)} ctx={renderContextFor(store)} />;
}
