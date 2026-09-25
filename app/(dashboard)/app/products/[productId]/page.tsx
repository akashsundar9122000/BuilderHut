import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ProductForm } from "@/components/dashboard/ProductForm";
import { requireActor } from "@/lib/auth/session";
import { getRootDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatMoneyInput } from "@/lib/money";
import { getProduct } from "@/lib/products/service";

export const metadata: Metadata = { title: "Edit product" };

/*
 * Editing a product.
 *
 * Products could be created and archived but never changed, which meant a
 * typo in a price was permanent — the merchant's only recourse was to archive
 * it and type the whole thing again, losing its address and any links to it.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const actor = await requireActor();
  const product = await getProduct(productId);
  // Zero rows means it belongs to another shop, or to nothing. Both are "not
  // found" as far as this merchant is concerned.
  if (!product) notFound();

  const rows = await getRootDb()
    .select({ currency: tenants.currency })
    .from(tenants)
    .where(eq(tenants.id, actor.tenantId!))
    .limit(1);
  const currency = rows[0]?.currency ?? "INR";

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <Link
        href="/app/products"
        className="text-muted hover:text-text mb-5 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Products
      </Link>

      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">{product.name}</h1>
        <p className="text-muted mt-1.5 text-sm">
          Changes go live on your shop as soon as you save.
        </p>
      </header>

      <ProductForm
        currencyLabel={currency}
        product={{
          id: product.id,
          name: product.name,
          description: product.description ?? "",
          price: formatMoneyInput(product.priceMinor, currency),
          compareAt:
            product.compareAtMinor === null
              ? ""
              : formatMoneyInput(product.compareAtMinor, currency),
          sku: product.sku ?? "",
          status: product.status,
          images: product.images,
        }}
      />
    </div>
  );
}
