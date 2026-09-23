"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { retryPaymentAction, type CheckoutState } from "@/app/(storefront)/s/[slug]/actions";
import { TEST_CARDS } from "@/lib/payments/test-cards";

/*
 * Paying for an order that already exists.
 *
 * Reached after a declined card. The basket is gone by then — it became this
 * order — so sending the customer back to the checkout would show them an empty
 * basket and look like their whole order had vanished. Paying against the order
 * is both kinder and how a real gateway works.
 */
export function RetryPayment({ slug, orderId }: { slug: string; orderId: string }) {
  const action = retryPaymentAction.bind(null, slug, orderId);
  const [state, submit, pending] = useActionState<CheckoutState, FormData>(action, {});

  return (
    <form action={submit} style={{ fontFamily: "var(--sf-font-body)", marginTop: 24 }}>
      <p style={{ fontSize: "0.92rem", margin: 0 }}>
        Your card wasn&rsquo;t accepted. Nothing has been charged, and your order is still
        here — try another card.
      </p>

      <label htmlFor="retry-card" style={{ display: "block", marginTop: 16 }}>
        <span style={{ display: "block", fontSize: "0.85rem", marginBottom: 6 }}>Card number</span>
        <input
          id="retry-card"
          name="cardNumber"
          required
          defaultValue="4242 4242 4242 4242"
          aria-invalid={Boolean(state.error)}
          style={{
            width: "100%",
            maxWidth: 320,
            minHeight: 46,
            padding: "10px 13px",
            // 16px floor, or iOS Safari zooms on focus.
            fontSize: "max(16px, 0.95rem)",
            fontFamily: "var(--sf-font-body)",
            color: "var(--sf-text)",
            background: "var(--sf-bg)",
            border: `max(1px, var(--sf-border-width)) solid ${state.error ? "var(--sf-accent)" : "var(--sf-border)"}`,
            borderRadius: "var(--sf-radius)",
          }}
        />
      </label>

      {state.error ? (
        <p role="alert" style={{ color: "var(--sf-accent)", fontSize: "0.85rem", marginTop: 8 }}>
          {state.error}
        </p>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", fontSize: "0.8rem" }}>
        {TEST_CARDS.map((card) => (
          <li key={card.number} style={{ color: "var(--sf-muted)", marginTop: 3 }}>
            <span style={{ fontFamily: "ui-monospace, monospace" }}>{card.number}</span> — {card.label}
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={pending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginTop: 18,
          minHeight: 48,
          padding: "0 26px",
          background: "var(--sf-primary)",
          color: "var(--sf-on-primary)",
          border: "none",
          borderRadius: "var(--sf-button-radius)",
          fontFamily: "var(--sf-font-body)",
          fontSize: "0.95rem",
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Trying again" : "Try this card"}
      </button>
    </form>
  );
}
