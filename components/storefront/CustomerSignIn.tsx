"use client";

import { useActionState, useState } from "react";

import { sendCodeAction, signInAction, type AuthState } from "@/app/(storefront)/s/[slug]/account-actions";
import {
  identifierAutoComplete,
  identifierInputType,
  identifierLabel,
  identifierPlaceholder,
} from "@/lib/customers/labels";
import type { AccountPolicyView } from "@/lib/render/context";
import { CustomerVerify } from "./CustomerVerify";
import { FieldShell, FormError, QuietLink, SubmitButton, inputStyle, phoneHint } from "./CustomerAuthBits";

/*
 * Signing in to a shop.
 *
 * Two idioms are lifted from components/auth/SignInForm.tsx, which does the same
 * job for merchants:
 *
 *  - one identical message for "no account" and "wrong password", because two
 *    different ones tell anybody who asks which addresses shop here;
 *  - a code path that doubles as the forgotten-password path, so there is one
 *    way back in rather than two.
 *
 * Which fields appear is the merchant's decision, read from their policy — a
 * password field on a shop that only sends codes would be a dead end.
 */

export function CustomerSignIn({
  slug,
  policy,
  next,
  buttonLabel,
  signupHref,
  signupLabel,
  base,
}: {
  slug: string;
  policy: AccountPolicyView;
  next: string | null;
  buttonLabel: string;
  signupHref: string | null;
  signupLabel: string;
  base: string;
}) {
  const [state, submit, pending] = useActionState<AuthState, FormData>(
    signInAction.bind(null, slug),
    {},
  );
  const [codeState, sendCode, sending] = useActionState<AuthState, FormData>(
    sendCodeAction.bind(null, slug),
    {},
  );
  const [identifier, setIdentifier] = useState("");

  const passwords = policy.credential !== "code";
  const codes = policy.credential !== "password";
  const inFlight = state.code ?? codeState.code;

  /*
   * Once a code is out, this becomes the verify screen in place — rather than
   * navigating — so the identifier and the form state do not have to survive a
   * round trip through the URL.
   */
  if (inFlight) {
    return (
      <CustomerVerify
        slug={slug}
        identifier={inFlight.identifier}
        channel={inFlight.channel}
        sentTo={inFlight.sentTo}
        next={next}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="next" value={next ?? ""} />
        <FieldShell
          label={identifierLabel(policy)}
          htmlFor="customer-identifier"
          hint={phoneHint(policy)}
          error={state.field === "identifier" ? state.error : undefined}
        >
          <input
            id="customer-identifier"
            name="identifier"
            type={identifierInputType(policy)}
            autoComplete={identifierAutoComplete(policy)}
            placeholder={identifierPlaceholder(policy)}
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            aria-invalid={state.field === "identifier" ? true : undefined}
            style={inputStyle}
          />
        </FieldShell>

        {passwords ? (
          <FieldShell
            label="Password"
            htmlFor="customer-password"
            error={state.field === "password" ? state.error : undefined}
          >
            <input
              id="customer-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={state.field === "password" ? true : undefined}
              style={inputStyle}
            />
          </FieldShell>
        ) : null}

        {!state.field ? <FormError message={state.error} /> : null}
        {!codeState.field ? <FormError message={codeState.error} /> : null}

        {passwords ? <SubmitButton pending={pending}>{buttonLabel}</SubmitButton> : null}
      </form>

      {codes ? (
        <form action={sendCode} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* The identifier already typed above, so nobody types it twice. */}
          <input type="hidden" name="identifier" value={identifier} />
          {passwords ? (
            <span
              style={{
                fontFamily: "var(--sf-font-body)",
                fontSize: "0.8rem",
                color: "var(--sf-muted)",
                textAlign: "center",
              }}
            >
              or
            </span>
          ) : null}
          <SubmitButton pending={sending} variant={passwords ? "quiet" : "primary"}>
            {sending ? "Sending…" : "Send me a code instead"}
          </SubmitButton>
        </form>
      ) : null}

      {signupHref ? (
        <div style={{ textAlign: "center" }}>
          <QuietLink href={`${base}${signupHref}`}>{signupLabel}</QuietLink>
        </div>
      ) : null}
    </div>
  );
}
