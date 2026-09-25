import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq } from "drizzle-orm";

import { ProductForm } from "@/components/dashboard/ProductForm";
import { requireActor } from "@/lib/auth/session";
import { getRootDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  const actor = await requireActor();
  const rows = await getRootDb()
    .select({ currency: tenants.currency })
    .from(tenants)
    .where(eq(tenants.id, actor.tenantId!))
    .limit(1);

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <Link
        href="/app/products"
        className="text-muted hover:text-text mb-5 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        Products
      </Link>
      <h1 className="font-display mb-7 text-3xl leading-tight">Add a product</h1>
      <ProductForm currencyLabel={rows[0]?.currency ?? "INR"} />
    </div>
  );
}
