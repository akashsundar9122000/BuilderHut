"use client";

import { useOptimistic, useTransition } from "react";

import { toggleWishlistAction } from "@/app/(storefront)/s/[slug]/account-actions";

/*
 * Keeping something for later.
 *
 * Signed out this is a LINK to the sign-in page, not a button: wishlist_items
 * requires a customer, so there is nowhere to put an anonymous save — and a button
 * that silently does nothing is worse than one that explains itself.
 */

export function WishlistButton({
  slug,
  productId,
  productName,
  saved,
  signedIn,
  loginHref,
}: {
  slug: string;
  productId: string;
  productName: string;
  saved: boolean;
  signedIn: boolean;
  loginHref: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <a href={loginHref} style={buttonStyle} aria-label={`Sign in to save ${productName}`}>
        Save for later
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Remove ${productName} from saved items` : `Save ${productName}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleWishlistAction(slug, productId);
        })
      }
      style={{ ...buttonStyle, cursor: pending ? "progress" : "pointer" }}
    >
      {optimistic ? "Saved" : "Save for later"}
    </button>
  );
}

const buttonStyle: React.CSSProperties = {
  minHeight: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  background: "transparent",
  border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
  borderRadius: "var(--sf-button-radius)",
  fontFamily: "var(--sf-font-body)",
  fontSize: "0.88rem",
  color: "var(--sf-text)",
  textDecoration: "none",
};
