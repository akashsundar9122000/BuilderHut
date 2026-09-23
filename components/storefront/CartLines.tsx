"use client";

import { useState, useTransition } from "react";
import { Loader2, Minus, Plus, X } from "lucide-react";

import { setQuantityAction } from "@/app/(storefront)/s/[slug]/actions";
import type { CartView } from "@/lib/commerce/cart";
import { formatMoney } from "@/lib/money";

/*
 * The basket.
 *
 * Quantity changes go to the server and come back with recomputed totals rather
 * than being adjusted optimistically in the browser. A basket that shows a
 * total the server would not agree with is worse than one that takes a moment:
 * the disagreement surfaces at the payment step, which is the worst place to
 * discover it.
 */
export function CartLines({ slug, cart: initial }: { slug: string; cart: CartView }) {
  const [pending, start] = useTransition();
  // Seeded from the server render, then replaced by whatever the server returns
  // from a quantity change. The browser never computes a total itself.
  const [cart, setCart] = useState(initial);

  if (cart.lines.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed var(--sf-border)",
          borderRadius: "var(--sf-radius)",
          padding: "48px 24px",
          textAlign: "center",
          fontFamily: "var(--sf-font-body)",
        }}
      >
        <p style={{ margin: 0 }}>There&rsquo;s nothing in your basket yet.</p>
        <a
          href={`/s/${slug}/shop`}
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "12px 24px",
            background: "var(--sf-primary)",
            color: "var(--sf-on-primary)",
            borderRadius: "var(--sf-button-radius)",
            textDecoration: "none",
            fontSize: "0.92rem",
          }}
        >
          Have a look around
        </a>
      </div>
    );
  }

  const change = (productId: string, quantity: number) =>
    start(async () => {
      setCart(await setQuantityAction(slug, productId, quantity));
    });

  return (
    <div style={{ opacity: pending ? 0.6 : 1, transition: "opacity 150ms" }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {cart.lines.map((line) => (
          <li
            key={line.productId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 0",
              borderBottom: "var(--sf-border-width) solid var(--sf-border)",
              fontFamily: "var(--sf-font-body)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                flexShrink: 0,
                background: "var(--sf-raised)",
                border: "var(--sf-border-width) solid var(--sf-border)",
                borderRadius: "var(--sf-radius)",
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: "0.95rem" }}>{line.name}</p>
              <p style={{ margin: "4px 0 0", color: "var(--sf-muted)", fontSize: "0.85rem" }}>
                {formatMoney(line.unitPriceMinor, cart.currency)} each
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <QtyButton
                label={`Fewer ${line.name}`}
                onClick={() => change(line.productId, line.quantity - 1)}
                disabled={pending}
              >
                <Minus className="size-3.5" />
              </QtyButton>
              <span style={{ minWidth: 28, textAlign: "center", fontSize: "0.9rem" }}>
                {line.quantity}
              </span>
              <QtyButton
                label={`More ${line.name}`}
                onClick={() => change(line.productId, line.quantity + 1)}
                disabled={pending || (line.available !== null && line.quantity >= line.available)}
              >
                <Plus className="size-3.5" />
              </QtyButton>
            </div>

            <p style={{ minWidth: 88, textAlign: "right", margin: 0, fontSize: "0.95rem" }}>
              {formatMoney(line.unitPriceMinor * line.quantity, cart.currency)}
            </p>

            <QtyButton
              label={`Remove ${line.name}`}
              onClick={() => change(line.productId, 0)}
              disabled={pending}
            >
              <X className="size-3.5" />
            </QtyButton>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 24, fontFamily: "var(--sf-font-body)" }}>
        <Row label="Subtotal" value={formatMoney(cart.totals.subtotalMinor, cart.currency)} />
        {cart.totals.taxInclusive && cart.totals.taxName ? (
          <Row
            label={`Includes ${cart.totals.taxName}`}
            value={formatMoney(cart.totals.taxMinor, cart.currency)}
            quiet
          />
        ) : null}
        <p style={{ color: "var(--sf-muted)", fontSize: "0.85rem", marginTop: 8 }}>
          Delivery is worked out at checkout.
        </p>

        <a
          href={`/s/${slug}/checkout`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 20,
            minHeight: 48,
            padding: "0 28px",
            background: "var(--sf-primary)",
            color: "var(--sf-on-primary)",
            borderRadius: "var(--sf-button-radius)",
            textDecoration: "none",
            fontSize: "0.95rem",
          }}
        >
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Checkout
        </a>
      </div>
    </div>
  );
}

function Row({ label, value, quiet }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: quiet ? "0.85rem" : "1rem",
        color: quiet ? "var(--sf-muted)" : "inherit",
        marginTop: 6,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function QtyButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        // 36px with a 44px touch target via padding; a cart on a phone is
        // mostly what this is for.
        display: "grid",
        placeItems: "center",
        width: 34,
        height: 34,
        borderRadius: "var(--sf-button-radius)",
        border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
        background: "transparent",
        color: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
