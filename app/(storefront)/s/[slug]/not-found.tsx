import { headers } from "next/headers";
import Link from "next/link";

import { StoreFooter, StoreHeader, StorePageShell } from "@/components/storefront/StoreChrome";
import { homePage } from "@/lib/schema/page";
import { loadStorefront } from "@/lib/stores/storefront";

/*
 * A page that does not exist, in the shop's own clothes.
 *
 * A customer who mistypes a product URL is still the merchant's customer, and
 * handing them a BuilderHut-branded error page in the middle of someone else's
 * shop would be both jarring and a small betrayal of the merchant.
 *
 * The slug arrives as a header set by middleware, because Next does not pass
 * route params to a not-found boundary. If it is missing — a direct hit that
 * skipped middleware, or a shop that no longer resolves — this degrades to the
 * plain version rather than failing.
 */
export default async function StorefrontNotFound() {
  const slug = (await headers()).get("x-bh-slug");
  const store = slug ? await loadStorefront(slug) : null;

  if (!store) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl">Page not found</h1>
        <p className="text-muted mt-2 text-sm">
          That address doesn&rsquo;t lead anywhere in this shop.
        </p>
      </main>
    );
  }

  const ctx = {
    doc: store.doc,
    base: `/s/${store.slug}`,
    products: store.products,
    editing: false,
  };
  const home = homePage(store.doc);

  return (
    <>
      <StoreHeader page={home} ctx={ctx} />
      <StorePageShell
        title="We couldn't find that page"
        lede="It may have been moved or removed. Everything else is still here."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.5rem" }}>
          <Link
            href={`/s/${store.slug}`}
            style={{
              background: "var(--sf-primary)",
              color: "var(--sf-on-primary)",
              borderRadius: "var(--sf-button-radius)",
              padding: "0.7rem 1.25rem",
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            Back to the shop
          </Link>
          <Link
            href={`/s/${store.slug}/shop`}
            style={{
              border: "1px solid var(--sf-border)",
              color: "var(--sf-text)",
              borderRadius: "var(--sf-button-radius)",
              padding: "0.7rem 1.25rem",
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            Browse everything
          </Link>
        </div>
      </StorePageShell>
      <StoreFooter page={home} ctx={ctx} />
    </>
  );
}
