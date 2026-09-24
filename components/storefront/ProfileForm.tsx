"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  saveProfileAction,
  type ProfileState,
} from "@/app/(storefront)/s/[slug]/account-actions";
import type { SignedInCustomer } from "@/lib/render/context";
import { FieldShell, FormError, SubmitButton, inputStyle } from "./CustomerAuthBits";

/*
 * Somebody's own details.
 *
 * The email address and mobile number are shown but not editable here: changing
 * either means proving the new one with a code, which is its own flow rather than
 * a field on a settings form.
 */

export function ProfileForm({
  slug,
  customer,
  acceptsMarketing,
  canSetPassword,
}: {
  slug: string;
  customer: SignedInCustomer;
  acceptsMarketing: boolean;
  /** False at a shop that signs everybody in with a code. */
  canSetPassword: boolean;
}) {
  const [state, submit, pending] = useActionState<ProfileState, FormData>(
    saveProfileAction.bind(null, slug),
    {},
  );
  const [passwordState, changePassword, changing] = useActionState<ProfileState, FormData>(
    changePasswordAction.bind(null, slug),
    {},
  );

  return (
    <div style={{ display: "grid", gap: 32, maxWidth: "32rem" }}>
      <form action={submit} style={{ display: "grid", gap: 14 }}>
        <FieldShell label="Your name" htmlFor="profile-name" error={state.field === "name" ? state.error : undefined}>
          <input
            id="profile-name"
            name="name"
            defaultValue={customer.name ?? ""}
            autoComplete="name"
            style={inputStyle}
          />
        </FieldShell>

        <div style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.9rem", display: "grid", gap: 4 }}>
          {customer.email ? (
            <div>
              <span style={{ color: "var(--sf-muted)" }}>Email: </span>
              {customer.email}
              {!customer.emailVerified ? (
                <span style={{ color: "var(--sf-muted)" }}> · not confirmed yet</span>
              ) : null}
            </div>
          ) : null}
          {customer.phone ? (
            <div>
              <span style={{ color: "var(--sf-muted)" }}>Mobile: </span>
              {customer.phone}
              {!customer.phoneVerified ? (
                <span style={{ color: "var(--sf-muted)" }}> · not confirmed yet</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontFamily: "var(--sf-font-body)",
            fontSize: "0.85rem",
            color: "var(--sf-muted)",
          }}
        >
          <input
            type="checkbox"
            name="acceptsMarketing"
            defaultChecked={acceptsMarketing}
            style={{ marginTop: 3 }}
          />
          Email me about new things and offers.
        </label>

        {!state.field ? <FormError message={state.error} /> : null}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <SubmitButton pending={pending}>Save</SubmitButton>
          {state.ok ? (
            <span style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.85rem", color: "var(--sf-muted)" }}>
              Saved.
            </span>
          ) : null}
        </div>
      </form>

      {canSetPassword ? (
        <form action={changePassword} style={{ display: "grid", gap: 14 }}>
          <h2 style={{ fontFamily: "var(--sf-font-heading)", fontSize: "1.05rem", margin: 0 }}>
            Password
          </h2>
          <FieldShell label="Current password" htmlFor="profile-current" hint="Leave empty if you have never set one.">
            <input id="profile-current" name="current" type="password" autoComplete="current-password" style={inputStyle} />
          </FieldShell>
          <FieldShell
            label="New password"
            htmlFor="profile-password"
            hint="At least 10 characters. Your other devices will be signed out."
            error={passwordState.field === "password" ? passwordState.error : undefined}
          >
            <input
              id="profile-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              style={inputStyle}
            />
          </FieldShell>
          {!passwordState.field ? <FormError message={passwordState.error} /> : null}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <SubmitButton pending={changing}>Change password</SubmitButton>
            {passwordState.ok ? (
              <span style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.85rem", color: "var(--sf-muted)" }}>
                Changed.
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
