"use client";

import { useActionState } from "react";

import { signUpAction, type AuthState } from "@/app/(storefront)/s/[slug]/account-actions";
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
 * Making an account at a shop.
 *
 * Per-field errors with aria-invalid, as components/auth/SignUpForm.tsx does for
 * merchants. What it deliberately does NOT do is tell somebody the address is
 * already taken: an account that exists here is answered with a code instead, so
 * this form cannot be used to find out who shops at somebody's shop.
 */

export function CustomerSignUp({
  slug,
  policy,
  next,
  askName,
  buttonLabel,
  signinHref,
  base,
}: {
  slug: string;
  policy: AccountPolicyView;
  next: string | null;
  askName: boolean;
  buttonLabel: string;
  signinHref: string | null;
  base: string;
}) {
  const [state, submit, pending] = useActionState<AuthState, FormData>(
    signUpAction.bind(null, slug),
    {},
  );

  if (state.code) {
    return (
      <CustomerVerify
        slug={slug}
        identifier={state.code.identifier}
        channel={state.code.channel}
        sentTo={state.code.sentTo}
        next={next}
      />
    );
  }

  const passwords = policy.credential !== "code";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      <form action={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <input type="hidden" name="next" value={next ?? ""} />

        {askName ? (
          <FieldShell
            label="Your name"
            htmlFor="customer-name"
            error={state.field === "name" ? state.error : undefined}
          >
            <input
              id="customer-name"
              name="name"
              type="text"
              autoComplete="name"
              aria-invalid={state.field === "name" ? true : undefined}
              style={inputStyle}
            />
          </FieldShell>
        ) : null}

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
            aria-invalid={state.field === "identifier" ? true : undefined}
            style={inputStyle}
          />
        </FieldShell>

        {passwords ? (
          <FieldShell
            label="Password"
            htmlFor="customer-password"
            hint="At least 10 characters."
            error={state.field === "password" ? state.error : undefined}
          >
            <input
              id="customer-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              aria-invalid={state.field === "password" ? true : undefined}
              style={inputStyle}
            />
          </FieldShell>
        ) : null}

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
          {/* Unticked by default. Consent that arrives pre-given is not consent. */}
          <input type="checkbox" name="acceptsMarketing" style={{ marginTop: 3 }} />
          Email me about new things and offers.
        </label>

        {!state.field ? <FormError message={state.error} /> : null}
        <SubmitButton pending={pending}>{buttonLabel}</SubmitButton>
      </form>

      {signinHref ? (
        <div style={{ textAlign: "center" }}>
          <QuietLink href={`${base}${signinHref}`}>I already have an account</QuietLink>
        </div>
      ) : null}
    </div>
  );
}
