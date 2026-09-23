import { notFound } from "next/navigation";

import { RenderPage } from "@/lib/render/render";
import { homePage } from "@/lib/schema/page";
import { loadStorefront } from "@/lib/stores/storefront";

export default async function StorefrontHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  return (
    <RenderPage
      page={homePage(store.doc)}
      ctx={{ doc: store.doc, base: `/s/${store.slug}`, products: store.products, editing: false }}
    />
  );
}
