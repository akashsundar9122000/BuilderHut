import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { getRootDb } from "@/lib/db/client";
import { productImages, products, siteVersions, tenants, websites } from "@/lib/db/schema";
import { SiteDocumentSchema, type SiteDocument } from "@/lib/schema/page";
import type { ProductCard } from "@/lib/render/context";
import { withTenant } from "@/lib/db/tenant";
import { imageUrlFor } from "@/lib/products/service";

/*
 * Reading a store for the public.
 *
 * The live storefront reads the PUBLISHED snapshot, never the draft — blueprint
 * section 33. That separation is the whole reason drafts and versions exist: a
 * half-finished edit must not reach a customer, and a rollback must be a
 * pointer change rather than an undo.
 *
 * Resolution order matters, and getting it wrong is silent.
 *
 * A visitor is anonymous: there is no session, so there is no tenant context,
 * so RLS matches nothing on any tenant-owned table. `tenants` is a PLATFORM
 * table and carries no policy, so the slug is resolved there FIRST to learn
 * which tenant this is — and only then does anything enter that tenant's scope
 * to read the website, its published version and its catalogue.
 *
 * Doing it the other way round — joining websites in the resolving query —
 * returns zero rows rather than an error, and presents as a 404 on a store that
 * demonstrably exists. That cost an hour; hence this comment.
 */

export interface StorefrontData {
  tenantId: string;
  websiteId: string;
  slug: string;
  storeName: string;
  currency: string;
  doc: SiteDocument;
  products: ProductCard[];
}

/** Slug to tenant. Reads only the platform-level table, so no context is needed. */
const resolveTenant = unstable_cache(
  async (slug: string) => {
    const rows = await getRootDb()
      .select({
        id: tenants.id,
        slug: tenants.slug,
        name: tenants.name,
        currency: tenants.currency,
        status: tenants.status,
      })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    const tenant = rows[0];
    // A suspended store serves nothing, and says the same thing an unknown slug
    // does — confirming that a suspended store exists is information too.
    if (!tenant || tenant.status !== "active") return null;
    return tenant;
  },
  ["storefront-tenant"],
  { tags: ["storefront"], revalidate: 300 },
);

/** The published document for a tenant, read inside that tenant's scope. */
const loadPublishedDoc = unstable_cache(
  async (tenantId: string) => {
    return withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
      const sites = await db.select(websites).limit(1);
      const site = sites[0];
      if (!site?.publishedVersionId) return null;

      const versions = await db
        .select(siteVersions)
        .where(eq(siteVersions.id, site.publishedVersionId))
        .limit(1);

      const snapshot = versions[0]?.snapshot;
      if (!snapshot) return null;

      const parsed = SiteDocumentSchema.safeParse(snapshot);
      if (!parsed.success) {
        // A published snapshot that no longer validates means the schema moved
        // under it. Better a 404 than a half-rendered store — the version is
        // immutable, so the fix is a migration, not a repair in place.
        console.error(
          `[storefront] published snapshot for tenant ${tenantId} failed validation:`,
          parsed.error.issues[0],
        );
        return null;
      }

      return { websiteId: site.id, doc: parsed.data };
    });
  },
  ["storefront-doc"],
  { tags: ["storefront"], revalidate: 300 },
);

export async function loadPublishedSite(
  slug: string,
): Promise<Omit<StorefrontData, "products"> | null> {
  const tenant = await resolveTenant(slug);
  if (!tenant) return null;

  const published = await loadPublishedDoc(tenant.id);
  if (!published) return null;

  return {
    tenantId: tenant.id,
    websiteId: published.websiteId,
    slug: tenant.slug,
    storeName: tenant.name,
    currency: tenant.currency,
    doc: published.doc,
  };
}

/**
 * The catalogue.
 *
 * Not cached alongside the document: prices and availability change without a
 * publish, and blueprint section 94 is explicit that inventory and order state
 * are not safe things to cache.
 */
export async function loadStorefrontProducts(
  tenantId: string,
  currency: string,
  limit = 24,
): Promise<ProductCard[]> {
  const { rows, firstImage } = await withTenant(
    { tenantId, actorId: tenantId, role: "staff" },
    async (db) => {
      const rows = await db
        .select(products)
        .where(and(eq(products.status, "active"), isNull(products.deletedAt)))
        .orderBy(desc(products.createdAt))
        .limit(limit);

      /*
       * One query for every product's first picture rather than one per card.
       * Ordered by position, so the first row seen for a product is the one
       * the merchant made the main image.
       */
      const images = await db.select(productImages).orderBy(productImages.position);
      const firstImage = new Map<string, string>();
      for (const image of images) {
        if (!firstImage.has(image.productId)) {
          firstImage.set(image.productId, imageUrlFor(image.mediaKey));
        }
      }
      return { rows, firstImage };
    },
  );

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    priceMinor: p.priceMinor,
    compareAtMinor: p.compareAtMinor,
    currency: p.currency || currency,
    imageUrl: firstImage.get(p.id) ?? null,
  }));
}

export async function loadStorefront(slug: string): Promise<StorefrontData | null> {
  const site = await loadPublishedSite(slug);
  if (!site) return null;
  const catalogue = await loadStorefrontProducts(site.tenantId, site.currency);
  return { ...site, products: catalogue };
}
