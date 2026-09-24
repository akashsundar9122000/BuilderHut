"use client";

import { useActionState, useState, useTransition } from "react";

import {
  deleteAddressAction,
  makeDefaultAddressAction,
  saveAddressAction,
  type AddressState,
} from "@/app/(storefront)/s/[slug]/account-actions";
import { FieldShell, FormError, SubmitButton, inputStyle } from "./CustomerAuthBits";

export interface SavedAddress {
  id: string;
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

/*
 * Addresses somebody has saved.
 *
 * The form is one form, used for adding and for editing, because two forms that
 * must stay in step is two forms that will not.
 */

function lines(address: SavedAddress): string[] {
  return [
    address.name,
    address.line1,
    address.line2,
    [address.city, address.region, address.postalCode].filter(Boolean).join(" "),
    address.country,
  ].filter((line): line is string => Boolean(line));
}

export function AddressBook({
  slug,
  addresses,
  defaultCountry,
}: {
  slug: string;
  addresses: SavedAddress[];
  defaultCountry: string;
}) {
  const [state, submit, pending] = useActionState<AddressState, FormData>(
    saveAddressAction.bind(null, slug),
    {},
  );
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [adding, setAdding] = useState(addresses.length === 0);
  const [busy, start] = useTransition();

  const showForm = adding || editing !== null;
  const values = editing;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {addresses.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {addresses.map((address) => (
            <li
              key={address.id}
              style={{
                background: "var(--sf-surface)",
                border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
                borderRadius: "var(--sf-radius)",
                padding: 16,
                fontFamily: "var(--sf-font-body)",
                fontSize: "0.9rem",
              }}
            >
              <address style={{ fontStyle: "normal", lineHeight: 1.6 }}>
                {lines(address).map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </address>
              {address.isDefault ? (
                <p style={{ color: "var(--sf-muted)", fontSize: "0.8rem", margin: "8px 0 0" }}>
                  Used by default at checkout
                </p>
              ) : null}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  aria-label={`Edit ${address.name}`}
                  onClick={() => {
                    setEditing(address);
                    setAdding(false);
                  }}
                  style={quietButton}
                >
                  Edit
                </button>
                {!address.isDefault ? (
                  <button
                    type="button"
                    aria-label={`Make ${address.name} the default`}
                    disabled={busy}
                    onClick={() => start(() => void makeDefaultAddressAction(slug, address.id))}
                    style={quietButton}
                  >
                    Use by default
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label={`Delete ${address.name}`}
                  disabled={busy}
                  onClick={() => start(() => void deleteAddressAction(slug, address.id))}
                  style={{ ...quietButton, color: "var(--sf-danger)" }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!showForm ? (
        <button type="button" onClick={() => setAdding(true)} style={quietButton}>
          Add an address
        </button>
      ) : (
        <form
          action={submit}
          // A changing key resets the fields when they switch which address they
          // are editing; without it the browser keeps the previous values.
          key={values?.id ?? "new"}
          style={{ display: "grid", gap: 14 }}
        >
          <input type="hidden" name="addressId" value={values?.id ?? ""} />

          <FieldShell label="Full name" htmlFor="addr-name" error={state.field === "name" ? state.error : undefined}>
            <input id="addr-name" name="name" defaultValue={values?.name ?? ""} autoComplete="name" required style={inputStyle} />
          </FieldShell>

          <FieldShell label="Mobile number" htmlFor="addr-phone">
            <input id="addr-phone" name="phone" type="tel" defaultValue={values?.phone ?? ""} autoComplete="tel" style={inputStyle} />
          </FieldShell>

          <FieldShell label="Address" htmlFor="addr-line1" error={state.field === "line1" ? state.error : undefined}>
            <input id="addr-line1" name="line1" defaultValue={values?.line1 ?? ""} autoComplete="address-line1" required style={inputStyle} />
          </FieldShell>

          <FieldShell label="Flat, floor, landmark" htmlFor="addr-line2">
            <input id="addr-line2" name="line2" defaultValue={values?.line2 ?? ""} autoComplete="address-line2" style={inputStyle} />
          </FieldShell>

          <FieldShell label="Town or city" htmlFor="addr-city" error={state.field === "city" ? state.error : undefined}>
            <input id="addr-city" name="city" defaultValue={values?.city ?? ""} autoComplete="address-level2" required style={inputStyle} />
          </FieldShell>

          <FieldShell label="State or region" htmlFor="addr-region">
            <input id="addr-region" name="region" defaultValue={values?.region ?? ""} autoComplete="address-level1" style={inputStyle} />
          </FieldShell>

          <FieldShell label="Postcode" htmlFor="addr-postalCode">
            <input id="addr-postalCode" name="postalCode" defaultValue={values?.postalCode ?? ""} autoComplete="postal-code" style={inputStyle} />
          </FieldShell>

          <FieldShell label="Country" htmlFor="addr-country">
            <input
              id="addr-country"
              name="country"
              defaultValue={values?.country ?? defaultCountry}
              maxLength={2}
              autoComplete="country"
              style={inputStyle}
            />
          </FieldShell>

          {!state.field ? <FormError message={state.error} /> : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SubmitButton pending={pending}>{values ? "Save changes" : "Save address"}</SubmitButton>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setAdding(false);
              }}
              style={quietButton}
            >
              Cancel
            </button>
          </div>
          {state.ok ? (
            <p style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.85rem", color: "var(--sf-muted)", margin: 0 }}>
              Saved.
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}

const quietButton: React.CSSProperties = {
  minHeight: 40,
  padding: "0 14px",
  background: "transparent",
  border: "max(1px, var(--sf-border-width)) solid var(--sf-border)",
  borderRadius: "var(--sf-button-radius)",
  fontFamily: "var(--sf-font-body)",
  fontSize: "0.88rem",
  color: "var(--sf-text)",
  cursor: "pointer",
};
