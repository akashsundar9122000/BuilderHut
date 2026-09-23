import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CartLines } from "@/components/storefront/CartLines";
import { StoreFooter, StoreHeader, StorePageShell } from "@/components/storefront/StoreChrome";
import { getCart } from "@/lib/commerce/cart";
import { homePage } from "@/lib/schema/page";
import { loadStorefront } from "@/lib/stores/storefront";

export const metadata: Metadata = { title: "Your basket", robots: { index: false } };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  const cart = await getCart(store.tenantId, store.currency);
  const ctx = { doc: store.doc, base: `/s/${store.slug}`, products: store.products, editing: false };
  const home = homePage(store.doc);

  return (
    <>
      <StoreHeader page={home} ctx={ctx} />
      <StorePageShell title="Your basket">
        <CartLines slug={store.slug} cart={cart} />
      </StorePageShell>
      <StoreFooter page={home} ctx={ctx} />
    </>
  );
}
