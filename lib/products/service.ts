import "server-only";

import { desc, eq, isNull } from "drizzle-orm";

import { products } from "@/lib/db/schema";
import { runForTenant } from "@/lib/auth/session";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/slug";

/*
 * Product operations, all through runForTenant.
 *
 * No function here takes a tenantId: the tenant comes from the session, every
 * time. A signature like getProduct(id, tenantId) invites a caller to pass the
 * wrong one, and blueprint section 35.1 asks for exactly that to be impossible.
 */

export interface ProductInput {
  name: string;
  description: string;
  price: string;
  compareAt: string;
  sku: string;
  status: "draft" | "active" | "archived";
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; field: string; message: string };

export async function listProducts() {
  return runForTenant((db) =>
    db
      .select(products)
      .where(isNull(products.deletedAt))
      .orderBy(desc(products.createdAt))
      .limit(100),
  );
}

export async function getProduct(id: string) {
  const rows = await runForTenant((db) => db.select(products).where(eq(products.id, id)));
  return rows[0] ?? null;
}

function validate(input: ProductInput, currency: string): SaveResult | { values: Record<string, unknown> } {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, field: "name", message: "Give the product a name." };
  if (name.length > 140) return { ok: false, field: "name", message: "That name is too long." };

  const priceMinor = parseMoney(input.price, currency);
  if (priceMinor === null) {
    return { ok: false, field: "price", message: "Enter a price like 1499 or 1499.50." };
  }

  let compareAtMinor: number | null = null;
  if (input.compareAt.trim()) {
    compareAtMinor = parseMoney(input.compareAt, currency);
    if (compareAtMinor === null) {
      return { ok: false, field: "compareAt", message: "Enter a number, or leave it blank." };
    }
    // A "was" price below the real price renders as a negative discount badge.
    if (compareAtMinor <= priceMinor) {
      return {
        ok: false,
        field: "compareAt",
        message: "The compare-at price should be higher than the price.",
      };
    }
  }

  return {
    values: {
      name,
      slug: slugify(name) || "product",
      description: input.description.trim() || null,
      priceMinor: BigInt(priceMinor),
      compareAtMinor: compareAtMinor === null ? null : BigInt(compareAtMinor),
      currency,
      sku: input.sku.trim() || null,
      status: input.status,
    },
  };
}

export async function createProduct(input: ProductInput, currency: string): Promise<SaveResult> {
  const checked = validate(input, currency);
  if ("ok" in checked) return checked;

  try {
    const rows = await runForTenant((db) => db.insert(products, checked.values));
    return { ok: true, id: rows[0]!.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Slugs are unique per tenant, and two products can genuinely share a name.
    if (/products_tenant_slug_key|duplicate key/i.test(message)) {
      return { ok: false, field: "name", message: "You already have a product with that name." };
    }
    console.error("[createProduct]", error);
    return { ok: false, field: "form", message: "We couldn't save that product." };
  }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  currency: string,
): Promise<SaveResult> {
  const checked = validate(input, currency);
  if ("ok" in checked) return checked;

  const rows = await runForTenant((db) =>
    db.update(products, checked.values, eq(products.id, id)),
  );
  if (rows.length === 0) {
    // Zero rows means the id belongs to another tenant, or to nothing. Both are
    // "not found" as far as this merchant is concerned.
    return { ok: false, field: "form", message: "That product no longer exists." };
  }
  return { ok: true, id };
}

/** Soft delete: a product is recoverable, and old orders still reference it. */
export async function archiveProduct(id: string): Promise<boolean> {
  const rows = await runForTenant((db) =>
    db.update(products, { deletedAt: new Date(), status: "archived" }, eq(products.id, id)),
  );
  return rows.length > 0;
}

export async function productStats() {
  const rows = await runForTenant((db) =>
    db.select(products).where(isNull(products.deletedAt)).limit(500),
  );
  return {
    total: rows.length,
    active: rows.filter((p) => p.status === "active").length,
    draft: rows.filter((p) => p.status === "draft").length,
  };
}
