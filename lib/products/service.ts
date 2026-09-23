import "server-only";

import { desc, eq, isNull } from "drizzle-orm";

import { uuidv7 } from "uuidv7";

import { productImages, products } from "@/lib/db/schema";
import type { TenantDb } from "@/lib/db/tenant";
import { runForTenant } from "@/lib/auth/session";
import { parseMoney } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { requireCapacity, EntitlementError } from "@/lib/plans/entitlements";

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
  /**
   * Pictures, in the order they should appear, as media keys or absolute URLs.
   *
   * The whole set every time rather than a diff: a product has a handful of
   * images and the form always knows all of them, so replacing the set is both
   * simpler and impossible to get half-applied.
   */
  images: string[];
}

/**
 * Where a stored picture is served from.
 *
 * A merchant can paste a URL to photography they already host, so the column
 * holds either a library key or an absolute address, and this tells them
 * apart. Storing a full URL for library assets instead would bake the current
 * storage backend into every row.
 */
export function imageUrlFor(mediaKey: string): string {
  return /^https?:\/\//.test(mediaKey) ? mediaKey : `/media/${mediaKey}`;
}

/** The reverse, for the form: a library URL becomes the key it came from. */
export function mediaKeyFrom(url: string): string {
  return url.startsWith("/media/") ? url.slice("/media/".length) : url;
}

const MAX_IMAGES = 8;

/**
 * Replace a product's pictures.
 *
 * Delete-then-insert rather than reconciling: the set is at most eight rows,
 * it happens inside the caller's transaction, and position is part of the
 * data — reordering by diff would be more code and more ways to end up with
 * two images claiming position 0.
 */
async function replaceImages(db: TenantDb, productId: string, images: string[]): Promise<void> {
  await db.delete(productImages, eq(productImages.productId, productId));

  const keys = images
    .map((value) => mediaKeyFrom(value.trim()))
    .filter((key) => key.length > 0 && key.length <= 400)
    .slice(0, MAX_IMAGES);

  for (const [position, mediaKey] of keys.entries()) {
    await db.insert(productImages, { id: uuidv7(), productId, mediaKey, position });
  }
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; field: string; message: string };

export async function listProducts() {
  return runForTenant(async (db) => {
    const rows = await db
      .select(products)
      .where(isNull(products.deletedAt))
      .orderBy(desc(products.createdAt))
      .limit(100);

    // One query for every product's first picture, rather than one per row.
    const images = await db.select(productImages).orderBy(productImages.position);
    const firstFor = new Map<string, string>();
    for (const image of images) {
      if (!firstFor.has(image.productId)) firstFor.set(image.productId, imageUrlFor(image.mediaKey));
    }

    return rows.map((row) => ({ ...row, imageUrl: firstFor.get(row.id) ?? null }));
  });
}

export async function getProduct(id: string) {
  return runForTenant(async (db) => {
    const [row] = await db.select(products).where(eq(products.id, id)).limit(1);
    if (!row) return null;

    const images = await db
      .select(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(productImages.position);

    return { ...row, images: images.map((image) => imageUrlFor(image.mediaKey)) };
  });
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
    const id = await runForTenant(async (db) => {
      /*
       * The plan's ceiling, checked where the row is written. The Add button
       * is also disabled at the limit, but a disabled button is a courtesy and
       * this is the rule.
       */
      await requireCapacity(db, "products");
      const rows = await db.insert(products, checked.values);
      const created = rows[0]!.id;
      await replaceImages(db, created, input.images);
      return created;
    });
    return { ok: true, id };
  } catch (error) {
    if (error instanceof EntitlementError) {
      return { ok: false, field: "form", message: error.message };
    }
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

  const rows = await runForTenant(async (db) => {
    const updated = await db.update(products, checked.values, eq(products.id, id));
    if (updated.length > 0) await replaceImages(db, id, input.images);
    return updated;
  });
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
