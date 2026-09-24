import type { Metadata } from "next";

import { AccountShell } from "@/components/storefront/AccountShell";
import { WishlistButton } from "@/components/storefront/WishlistButton";
import { formatMoney } from "@/lib/money";
import { loadAccountPage, loadAccountSummary } from "@/lib/storefront/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved items", robots: { index: false } };

export default async function AccountWishlistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { ctx, store, customer } = await loadAccountPage(slug, "/account/wishlist");
  const { wishlist } = await loadAccountSummary(store, customer.customerId, 1);

  return (
    <AccountShell
      ctx={ctx}
      slug={slug}
      title="Saved items"
      lede="Things you have kept for later."
      active="wishlist"
    >
      {wishlist.length === 0 ? (
        <p style={{ fontFamily: "var(--sf-font-body)", color: "var(--sf-muted)" }}>
          Nothing saved yet. The save button on a product keeps it here.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          }}
        >
          {wishlist.map((product) => (
            <li
              key={product.id}
              style={{
                background: "var(--sf-surface)",
                border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
                borderRadius: "var(--sf-radius)",
                padding: 14,
                fontFamily: "var(--sf-font-body)",
                display: "grid",
                gap: 8,
              }}
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: "var(--sf-radius)" }}
                />
              ) : null}
              <a href={`${ctx.base}/p/${product.slug}`} style={{ color: "var(--sf-text)", fontSize: "0.95rem" }}>
                {product.name}
              </a>
              <span style={{ color: "var(--sf-muted)", fontSize: "0.88rem" }}>
                {formatMoney(product.priceMinor, product.currency)}
                {product.soldOut ? " · sold out" : ""}
              </span>
              <WishlistButton
                slug={slug}
                productId={product.id}
                productName={product.name}
                saved
                signedIn
                loginHref={`${ctx.base}/login`}
              />
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
