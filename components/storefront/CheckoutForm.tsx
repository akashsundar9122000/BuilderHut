"use client";

import { useActionState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { checkoutAction, type CheckoutState } from "@/app/(storefront)/s/[slug]/actions";
import { TEST_CARDS } from "@/lib/payments/test-cards";
import type { CartView } from "@/lib/commerce/cart";
import { formatMoney } from "@/lib/money";

export interface ShippingChoice {
  id: string;
  name: string;
  description: string | null;
  priceLabel: string;
  isPickup: boolean;
}

/*
 * Checkout.
 *
 * The whole form is the merchant's styling, not BuilderHut's — a checkout that
 * suddenly looked like a different product is exactly where a customer
 * abandons. Fields are plain HTML with real labels and autocomplete hints,
 * because this is the form most likely to be filled on a phone with one thumb.
 *
 * The payment section says plainly that nothing is charged. Pretending
 * otherwise, even in a demo, is the kind of thing that ends up taking a real
 * card number from someone who did not read carefully.
 */
export function CheckoutForm({
  slug,
  cart,
  shipping,
  idempotencyKey,
  requirePhone,
  allowNotes,
}: {
  slug: string;
  cart: CartView;
  shipping: ShippingChoice[];
  idempotencyKey: string;
  requirePhone: boolean;
  allowNotes: boolean;
}) {
  const action = checkoutAction.bind(null, slug);
  const [state, submit, pending] = useActionState<CheckoutState, FormData>(action, {});

  const needsAddress = cart.lines.some((line) => line.requiresShipping);

  return (
    <form action={submit} className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div style={{ fontFamily: "var(--sf-font-body)" }}>
        <Fieldset legend="Where to send it">
          <Field label="Your name" name="name" autoComplete="name" required />
          <Field label="Email" name="email" type="email" autoComplete="email" required
                 hint="We'll send your order confirmation here." />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" required={requirePhone} />

          {needsAddress ? (
            <>
              <Field label="Address" name="line1" autoComplete="address-line1" required />
              <Field label="Address line 2" name="line2" autoComplete="address-line2" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Town or city" name="city" autoComplete="address-level2" required />
                <Field label="State" name="region" autoComplete="address-level1" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Postcode" name="postalCode" autoComplete="postal-code" />
                <Field label="Country" name="country" autoComplete="country" defaultValue="IN" />
              </div>
            </>
          ) : null}
        </Fieldset>

        <Fieldset legend="How you'd like it">
          {shipping.length === 0 ? (
            <p style={{ color: "var(--sf-muted)", fontSize: "0.9rem" }}>
              This shop hasn&rsquo;t set up delivery options yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {shipping.map((option, i) => (
                <label
                  key={option.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 14,
                    border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
                    borderRadius: "var(--sf-radius)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="shippingMethodId"
                    value={option.id}
                    defaultChecked={i === 0}
                    required
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: "0.95rem" }}>{option.name}</span>
                    {option.description ? (
                      <span style={{ display: "block", color: "var(--sf-muted)", fontSize: "0.85rem" }}>
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ fontSize: "0.9rem" }}>{option.priceLabel}</span>
                </label>
              ))}
            </div>
          )}
        </Fieldset>

        {allowNotes ? (
          <Fieldset legend="Anything we should know?">
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "0.85rem", marginBottom: 6 }}>
                Notes for the shop
              </span>
              <textarea
                name="customerNote"
                rows={3}
                placeholder="Gift wrapping, a delivery time that suits, allergies…"
                style={inputStyle}
              />
            </label>
          </Fieldset>
        ) : null}

        <Fieldset legend="Payment">
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: 14,
              marginBottom: 16,
              background: "var(--sf-raised)",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
              borderRadius: "var(--sf-radius)",
            }}
          >
            <ShieldAlert className="size-4 shrink-0" style={{ marginTop: 2 }} />
            <div style={{ fontSize: "0.85rem", lineHeight: 1.55 }}>
              <strong>This is a test checkout.</strong> No money moves and no card details are
              stored. Use one of the numbers below to see how each outcome behaves.
            </div>
          </div>

          <Field
            label="Card number"
            name="cardNumber"
            required
            defaultValue="4242 4242 4242 4242"
            error={state.field === "cardNumber" ? state.error : undefined}
          />

          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", fontSize: "0.82rem" }}>
            {TEST_CARDS.map((card) => (
              <li key={card.number} style={{ color: "var(--sf-muted)", marginTop: 4 }}>
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{card.number}</span>
                {" — "}
                {card.label}
              </li>
            ))}
          </ul>
        </Fieldset>

        {state.error && state.field !== "cardNumber" ? (
          <p
            role="alert"
            style={{
              marginTop: 18,
              padding: "12px 14px",
              background: "var(--sf-raised)",
              border: "max(1px, var(--sf-border-width)) solid var(--sf-accent)",
              borderRadius: "var(--sf-radius)",
              fontSize: "0.9rem",
            }}
          >
            {state.error}
          </p>
        ) : null}
      </div>

      <aside>
        <div
          style={{
            position: "sticky",
            top: 24,
            padding: 20,
            background: "var(--sf-surface)",
            border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
            borderRadius: "var(--sf-radius)",
            fontFamily: "var(--sf-font-body)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--sf-muted)" }}>
            Your order
          </p>

          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
            {cart.lines.map((line) => (
              <li key={line.productId} style={{ display: "flex", gap: 10, marginTop: 10, fontSize: "0.88rem" }}>
                <span style={{ flex: 1 }}>
                  {line.name}
                  <span style={{ color: "var(--sf-muted)" }}> × {line.quantity}</span>
                </span>
                <span>{formatMoney(line.unitPriceMinor * line.quantity, cart.currency)}</span>
              </li>
            ))}
          </ul>

          <div style={{ borderTop: "var(--sf-border-width) solid var(--sf-border)", marginTop: 16, paddingTop: 14 }}>
            <Row label="Subtotal" value={formatMoney(cart.totals.subtotalMinor, cart.currency)} />
            {cart.totals.discountMinor > 0 ? (
              <Row label="Discount" value={`−${formatMoney(cart.totals.discountMinor, cart.currency)}`} />
            ) : null}
            <Row
              label="Delivery"
              value={
                cart.totals.shippingMinor === 0
                  ? "Free"
                  : formatMoney(cart.totals.shippingMinor, cart.currency)
              }
            />
            {cart.totals.taxName && !cart.totals.taxInclusive ? (
              <Row label={cart.totals.taxName} value={formatMoney(cart.totals.taxMinor, cart.currency)} />
            ) : null}
            <Row label="Total" value={formatMoney(cart.totals.totalMinor, cart.currency)} strong />
            {cart.totals.taxName && cart.totals.taxInclusive ? (
              <p style={{ color: "var(--sf-muted)", fontSize: "0.78rem", marginTop: 6 }}>
                Includes {formatMoney(cart.totals.taxMinor, cart.currency)} {cart.totals.taxName}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={pending || cart.lines.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              minHeight: 50,
              marginTop: 20,
              background: "var(--sf-primary)",
              color: "var(--sf-on-primary)",
              border: "none",
              borderRadius: "var(--sf-button-radius)",
              fontFamily: "var(--sf-font-body)",
              fontSize: "0.98rem",
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.75 : 1,
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Placing your order" : `Pay ${formatMoney(cart.totals.totalMinor, cart.currency)}`}
          </button>
        </div>
      </aside>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  padding: "10px 13px",
  // 16px minimum, or iOS Safari zooms the page when the field is focused.
  fontSize: "max(16px, 0.95rem)",
  fontFamily: "var(--sf-font-body)",
  color: "var(--sf-text)",
  background: "var(--sf-bg)",
  border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
  borderRadius: "var(--sf-radius)",
};

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 32px" }}>
      <legend
        style={{
          fontFamily: "var(--sf-font-heading)",
          fontSize: "calc(1.1rem * var(--sf-scale))",
          letterSpacing: "var(--sf-heading-tracking)",
          padding: 0,
          marginBottom: 14,
        }}
      >
        {legend}
      </legend>
      <div className="flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
  hint,
  error,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  defaultValue?: string;
}) {
  const id = `co-${name}`;
  return (
    <label htmlFor={id} style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "0.85rem", marginBottom: 6 }}>
        {label}
        {required ? null : <span style={{ color: "var(--sf-muted)" }}> (optional)</span>}
      </span>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        style={{ ...inputStyle, borderColor: error ? "var(--sf-accent)" : undefined }}
      />
      {error ? (
        <span style={{ display: "block", color: "var(--sf-accent)", fontSize: "0.8rem", marginTop: 5 }}>
          {error}
        </span>
      ) : hint ? (
        <span style={{ display: "block", color: "var(--sf-muted)", fontSize: "0.8rem", marginTop: 5 }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 8,
        fontSize: strong ? "1.05rem" : "0.9rem",
        fontWeight: strong ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
