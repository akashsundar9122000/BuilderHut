"use client";

import { useState, useTransition } from "react";
import { Loader2, Minus, Plus, X } from "lucide-react";

import { applyDiscountAction, setQuantityAction } from "@/app/(storefront)/s/[slug]/actions";
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
  const [code, setCode] = useState("");
  /*
   * The message and whether it was a refusal, together. A code that is real but
   * below its minimum basket comes back ok:true with an explanation — colouring
   * that as an error would tell the shopper their valid code had failed.
   */
  const [codeMessage, setCodeMessage] = useState<{ text: string; ok: boolean } | null>(null);

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
          /*
           * Wraps rather than squeezes.
           *
           * As one unbreakable row this collapsed at phone width: the image,
           * the quantity stepper, the line total and the remove button are all
           * fixed-width, so the product name was squashed to nothing and the
           * stepper was drawn straight over the top of it. Letting the
           * controls drop to a second line keeps every part of it readable at
           * 390px and changes nothing at all on a desktop, where it still fits.
           */
          <li
            key={line.productId}
            className="flex flex-wrap items-center gap-x-4 gap-y-3"
            style={{
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
            <div className="min-w-0 flex-1 basis-40">
              <p style={{ margin: 0, fontSize: "0.95rem" }}>{line.name}</p>
              <p style={{ margin: "4px 0 0", color: "var(--sf-muted)", fontSize: "0.85rem" }}>
                {formatMoney(line.unitPriceMinor, cart.currency)} each
              </p>
            </div>

            <div className="ml-auto flex items-center gap-4">
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
            </div>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 24, fontFamily: "var(--sf-font-body)" }}>
        {/* A discount code. Re-checked on the server every time the basket is
            priced, so one that expires stops applying rather than lingering. */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          <input
            aria-label="Discount code"
            placeholder="Discount code"
            value={cart.totals.discountCode ?? code}
            disabled={Boolean(cart.totals.discountCode) || pending}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{
              flex: "1 1 180px",
              minHeight: 44,
              padding: "0 13px",
              fontSize: "max(16px, 0.9rem)",
              fontFamily: "var(--sf-font-body)",
              color: "var(--sf-text)",
              background: "var(--sf-surface)",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              borderRadius: "var(--sf-button-radius)",
              textTransform: "uppercase",
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const applied = cart.totals.discountCode;
                const result = await applyDiscountAction(slug, applied ? null : code);
                setCart(result.cart);
                setCodeMessage(result.message ? { text: result.message, ok: result.ok } : null);
                if (applied) setCode("");
              })
            }
            style={{
              minHeight: 44,
              padding: "0 18px",
              background: "transparent",
              color: "inherit",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              borderRadius: "var(--sf-button-radius)",
              fontFamily: "var(--sf-font-body)",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {cart.totals.discountCode ? "Remove" : "Apply"}
          </button>
        </div>
        {codeMessage ? (
          <p
            role={codeMessage.ok ? "status" : "alert"}
            style={{
              color: codeMessage.ok ? "var(--sf-muted)" : "var(--sf-danger)",
              fontSize: "0.83rem",
              marginTop: -10,
              marginBottom: 14,
            }}
          >
            {codeMessage.text}
          </p>
        ) : null}

        <Row label="Subtotal" value={formatMoney(cart.totals.subtotalMinor, cart.currency)} />
        {cart.totals.discountMinor > 0 ? (
          <Row
            label={`Discount (${cart.totals.discountCode})`}
            value={`−${formatMoney(cart.totals.discountMinor, cart.currency)}`}
          />
        ) : null}
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
