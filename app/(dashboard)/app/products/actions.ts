"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActor } from "@/lib/auth/session";
import { getRootDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { archiveProduct, createProduct, type ProductInput } from "@/lib/products/service";

export type ProductFormState = { error?: string; field?: string };

async function currencyForActor(tenantId: string): Promise<string> {
  const rows = await getRootDb()
    .select({ currency: tenants.currency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0]?.currency ?? "INR";
}

function readForm(formData: FormData): ProductInput {
  const status = String(formData.get("status") ?? "draft");
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    price: String(formData.get("price") ?? ""),
    compareAt: String(formData.get("compareAt") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    status: status === "active" || status === "archived" ? status : "draft",
  };
}

export async function createProductAction(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const actor = await requireActor();
  if (!actor.tenantId) return { error: "You don't have a store yet." };

  // The currency is the store's, never a field in the form. A price submitted
  // with a currency of the browser's choosing is a pricing bug waiting to bill
  // someone in the wrong denomination.
  const currency = await currencyForActor(actor.tenantId);
  const result = await createProduct(readForm(formData), currency);

  if (!result.ok) return { error: result.message, field: result.field };

  revalidatePath("/app/products");
  revalidatePath("/app");
  redirect("/app/products?added=1");
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  await requireActor();
  const id = String(formData.get("id") ?? "");
  if (id) await archiveProduct(id);
  revalidatePath("/app/products");
  revalidatePath("/app");
}
