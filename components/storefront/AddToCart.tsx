"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import { addToCartAction } from "@/app/(storefront)/s/[slug]/actions";

/*
 * The one button on a storefront that must never feel uncertain.
 *
 * It reports three states plainly — working, added, or why not — because the
 * alternative is a customer clicking twice and wondering whether they now have
 * two. The confirmation lingers rather than flashing, and reverts so the button
 * is ready again.
 */
export function AddToCart({
  slug,
  productId,
  soldOut = false,
  label = "Add to basket",
}: {
  slug: string;
  productId: string;
  soldOut?: boolean;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    padding: "0 26px",
    borderRadius: "var(--sf-button-radius)",
    fontFamily: "var(--sf-font-body)",
    fontSize: "0.95rem",
    fontWeight: 500,
    border: "none",
    cursor: soldOut ? "not-allowed" : "pointer",
    background: soldOut ? "var(--sf-border)" : "var(--sf-primary)",
    color: soldOut ? "var(--sf-muted)" : "var(--sf-on-primary)",
    opacity: pending ? 0.75 : 1,
    transition: "opacity 150ms, background 150ms",
  };

  return (
    <div>
      <button
        type="button"
        disabled={soldOut || pending}
        style={style}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await addToCartAction(slug, productId, 1);
            if (result.ok) {
              setAdded(true);
              setTimeout(() => setAdded(false), 2400);
            } else {
              setError(result.message ?? "That didn't work.");
            }
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {added && !pending ? <Check className="size-4" /> : null}
        {soldOut ? "Sold out" : pending ? "Adding" : added ? "In your basket" : label}
      </button>

      {error ? (
        <p
          role="alert"
          style={{
            fontFamily: "var(--sf-font-body)",
            color: "var(--sf-accent)",
            fontSize: "0.85rem",
            marginTop: 10,
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
