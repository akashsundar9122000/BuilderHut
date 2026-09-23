import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Builder } from "@/components/builder/Builder";
import { requireActor } from "@/lib/auth/session";
import { loadDraft } from "@/lib/builder/service";
import { loadStorefrontProducts } from "@/lib/stores/storefront";

export const metadata: Metadata = { title: "Store builder" };

export default async function BuilderPage() {
  const actor = await requireActor();
  if (!actor.tenantId) redirect("/onboarding");

  const draft = await loadDraft();
  if (!draft) redirect("/app");

  /*
   * Real products on the canvas, not placeholders. A merchant designing a
   * product grid needs to see their own photographs and prices in it — a grid
   * of grey boxes tells them nothing about whether the layout works.
   */
  const products = await loadStorefrontProducts(actor.tenantId, "INR", 12);

  return (
    <Builder
      initialDoc={draft.doc}
      initialRevision={draft.revision}
      storeSlug={actor.tenantSlug ?? ""}
      products={products}
    />
  );
}
