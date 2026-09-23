import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { AddToCart } from "@/components/storefront/AddToCart";
import { StoreFooter, StoreHeader } from "@/components/storefront/StoreChrome";
import { ImageSlot } from "@/lib/render/sections/shared";
import { withTenant } from "@/lib/db/tenant";
import { products } from "@/lib/db/schema";
import { discountPercent, formatMoney } from "@/lib/money";
import { homePage } from "@/lib/schema/page";
import { loadStorefront } from "@/lib/stores/storefront";
import { after } from "next/server";
import { track, trackContext } from "@/lib/analytics/track";

async function loadProduct(tenantId: string, slug: string) {
  const rows = await withTenant({ tenantId, actorId: tenantId, role: "staff" }, (db) =>
    db
      .select(products)
      .where(and(eq(products.slug, slug), eq(products.status, "active"), isNull(products.deletedAt)))
      .limit(1),
  );
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}): Promise<Metadata> {
  const { slug, product: productSlug } = await params;
  const store = await loadStorefront(slug);
  if (!store) return { title: "Not found" };
  const product = await loadProduct(store.tenantId, productSlug);
  if (!product) return { title: "Not found" };

  return {
    title: { absolute: product.seoTitle || `${product.name} · ${store.storeName}` },
    description: product.seoDescription || product.description || undefined,
    openGraph: { title: product.name, type: "website" },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string; product: string }>;
}) {
  const { slug, product: productSlug } = await params;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  const product = await loadProduct(store.tenantId, productSlug);
  if (!product) notFound();

  const measured = await trackContext();
  after(() =>
    track(store.tenantId, "product_view", measured, {
      path: `/p/${productSlug}`,
      productId: product.id,
    }),
  );

  const ctx = {
    doc: store.doc,
    base: `/s/${store.slug}`,
    products: store.products,
    editing: false,
  };
  const home = homePage(store.doc);
  const off = discountPercent(product.priceMinor, product.compareAtMinor);
  const soldOut = product.trackStock && product.stock <= 0;

  /*
   * Product structured data, so a search engine can show the price and whether
   * it is in stock. Blueprint section 21 asks for it, and for a small shop
   * arriving through search this is most of their visibility.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    sku: product.sku ?? undefined,
    offers: {
      "@type": "Offer",
      price: (Number(product.priceMinor) / 100).toFixed(2),
      priceCurrency: product.currency,
      availability: soldOut
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
  };

  return (
    <>
      <StoreHeader page={home} ctx={ctx} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main
        style={{
          paddingTop: "calc(var(--sf-section-y) * 0.7)",
          paddingBottom: "var(--sf-section-y)",
        }}
      >
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 sm:px-8 md:grid-cols-2 md:gap-14">
          <ImageSlot url={null} alt={product.name} ratio="1 / 1" />

          <div>
            <h1
              style={{
                fontFamily: "var(--sf-font-heading)",
                fontWeight: "var(--sf-heading-weight)" as unknown as number,
                letterSpacing: "var(--sf-heading-tracking)",
                textTransform: "var(--sf-heading-transform)" as React.CSSProperties["textTransform"],
                fontSize: "calc(clamp(1.6rem, 1.2rem + 1.8vw, 2.4rem) * var(--sf-scale))",
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              {product.name}
            </h1>

            <p
              style={{
                fontFamily: "var(--sf-font-body)",
                fontSize: "1.2rem",
                marginTop: 14,
                display: "flex",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span>{formatMoney(product.priceMinor, product.currency)}</span>
              {off ? (
                <>
                  <s style={{ color: "var(--sf-muted)", fontSize: "0.95rem" }}>
                    {formatMoney(product.compareAtMinor!, product.currency)}
                  </s>
                  <span
                    style={{
                      background: "var(--sf-accent)",
                      color: "var(--sf-on-primary)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      padding: "4px 9px",
                      borderRadius: "var(--sf-button-radius)",
                    }}
                  >
                    {off}% off
                  </span>
                </>
              ) : null}
            </p>

            {product.description ? (
              <div style={{ marginTop: 22 }}>
                {product.description.split(/\n{2,}/).map((para, i) => (
                  <p
                    key={i}
                    style={{
                      fontFamily: "var(--sf-font-body)",
                      color: "var(--sf-muted)",
                      lineHeight: 1.75,
                      marginTop: i === 0 ? 0 : 14,
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 28 }}>
              <AddToCart slug={store.slug} productId={product.id} soldOut={soldOut} />
            </div>

            {product.trackStock && product.stock > 0 && product.stock <= product.lowStockAt ? (
              <p
                style={{
                  fontFamily: "var(--sf-font-body)",
                  color: "var(--sf-accent)",
                  fontSize: "0.85rem",
                  marginTop: 14,
                }}
              >
                Only {product.stock} left.
              </p>
            ) : null}

            {product.sku ? (
              <p
                style={{
                  fontFamily: "var(--sf-font-body)",
                  color: "var(--sf-muted)",
                  fontSize: "0.8rem",
                  marginTop: 22,
                }}
              >
                {product.sku}
              </p>
            ) : null}
          </div>
        </div>
      </main>

      <StoreFooter page={home} ctx={ctx} />
    </>
  );
}
