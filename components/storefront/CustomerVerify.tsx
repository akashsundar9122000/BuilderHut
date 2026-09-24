"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  sendCodeAction,
  verifyCodeAction,
  type AuthState,
} from "@/app/(storefront)/s/[slug]/account-actions";
import { FormError, SubmitButton, inputStyle } from "./CustomerAuthBits";

/*
 * Entering the code.
 *
 * Six boxes, paste-spread across them, and auto-submit on the sixth — the same
 * arrangement as components/auth/VerifyForm.tsx, because a customer who has met
 * one code screen on this platform should not find a different one here. The
 * 45-second resend wait is the same number too.
 *
 * Styling is --sf-* rather than components/ui: this renders inside a merchant's
 * shop, on a page they may have laid out themselves.
 */

const LENGTH = 6;
const RESEND_COOLDOWN = 45;

/*
 * The boxes own their own digits, and the parent throws them away by changing
 * their key after every attempt.
 *
 * That is deliberately not an effect that clears them: setState inside an effect
 * means a second render pass for every submission, and "start again" is what
 * remounting already means.
 */
function CodeBoxes({
  invalid,
  disabled,
  onComplete,
}: {
  invalid: boolean;
  disabled: boolean;
  onComplete: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((current) => current.map((digit, i) => (i === index ? "" : digit)));
      return;
    }
    // A pasted code lands in whichever box has focus; spread it over the rest
    // rather than making somebody type six digits they already have.
    const next = [...digits];
    for (let i = 0; i < clean.length && index + i < LENGTH; i += 1) {
      next[index + i] = clean[i]!;
    }
    /*
     * flushSync, and it is not optional.
     *
     * The hidden field below carries the code, and FormData reads the DOM at
     * submit time — so calling requestSubmit() straight after setDigits() posts
     * the value from BEFORE this keystroke, which for a pasted code means an
     * empty one. The form then came back with "that code isn't right" about a
     * code the customer had entered perfectly. Flushing makes the DOM match the
     * state before anything submits.
     */
    flushSync(() => setDigits(next));
    inputs.current[Math.min(index + clean.length, LENGTH - 1)]?.focus();
    if (next.every(Boolean)) onComplete();
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  return (
    <>
      {/*
       * The hidden field is what the action reads when JavaScript is running; the
       * per-box `name` below is what it reads when none is. Both are here on
       * purpose — the sign-up form works with the client bundle missing entirely,
       * and a code screen that did not would be the one broken step in the flow.
       */}
      <input type="hidden" name="code" value={digits.join("")} />
      <div style={{ display: "flex", gap: 8 }} role="group" aria-label="Verification code">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            // inputMode numeric brings up the number pad without type="number"'s
            // spinners and validation quirks.
            name="digit"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={LENGTH}
            aria-label={`Digit ${index + 1}`}
            aria-invalid={invalid ? true : undefined}
            value={digit}
            disabled={disabled}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onFocus={(event) => event.target.select()}
            style={{
              ...inputStyle,
              width: "100%",
              minWidth: 0,
              height: 54,
              padding: 0,
              textAlign: "center",
              fontSize: "1.25rem",
              borderColor: invalid ? "var(--sf-danger)" : "var(--sf-border)",
            }}
          />
        ))}
      </div>
    </>
  );
}

function ResendForm({
  identifier,
  action,
  sending,
  error,
}: {
  identifier: string;
  action: (formData: FormData) => void;
  sending: boolean;
  error?: string;
}) {
  const [left, setLeft] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="hidden" name="identifier" value={identifier} />
      <SubmitButton pending={sending || left > 0} variant="quiet">
        {left > 0 ? `Resend in ${left}s` : sending ? "Sending…" : "Send another code"}
      </SubmitButton>
      <FormError message={error} />
    </form>
  );
}

export function CustomerVerify({
  slug,
  identifier,
  channel,
  sentTo,
  next,
}: {
  slug: string;
  identifier: string;
  channel: "email" | "sms";
  /** Already masked by the server. The full address is never sent back. */
  sentTo: string;
  next: string | null;
}) {
  const [state, submit, pending] = useActionState<AuthState, FormData>(
    verifyCodeAction.bind(null, slug),
    {},
  );
  const [resendState, resend, resending] = useActionState<AuthState, FormData>(
    sendCodeAction.bind(null, slug),
    {},
  );

  const form = useRef<HTMLFormElement | null>(null);

  /*
   * Both keys come from the server's stamp on the result.
   *
   * Changing a key remounts, which is what clears the boxes after an attempt and
   * restarts the wait after a resend. Doing it this way rather than by comparing
   * the previous state during render is what keeps this component pure — and it
   * means two identical error messages in a row still clear the boxes, which
   * comparing the message would not.
   */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
      <p style={{ fontFamily: "var(--sf-font-body)", fontSize: "0.9rem", color: "var(--sf-muted)", margin: 0 }}>
        We sent a 6-digit code {channel === "sms" ? "by text to" : "to"}{" "}
        <span style={{ color: "var(--sf-text)" }}>{sentTo}</span>.
      </p>

      <form ref={form} action={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="hidden" name="identifier" value={identifier} />
        <input type="hidden" name="next" value={next ?? ""} />

        <CodeBoxes
          key={state.at ?? 0}
          invalid={Boolean(state.error)}
          disabled={pending}
          onComplete={() => form.current?.requestSubmit()}
        />

        <FormError message={state.error} />
        {/*
         * A real button, not only the auto-submit. It is what makes the screen
         * usable without JavaScript, and it gives somebody on a keyboard an
         * obvious way to commit rather than relying on the sixth box firing.
         */}
        <SubmitButton pending={pending}>{pending ? "Checking…" : "Sign in"}</SubmitButton>
      </form>

      <ResendForm
        key={resendState.at ?? 0}
        identifier={identifier}
        action={resend}
        sending={resending}
        error={resendState.error}
      />
    </div>
  );
}
