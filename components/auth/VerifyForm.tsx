"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

const LENGTH = 6;
const RESEND_COOLDOWN = 45;

/** a***@gmail.com — enough to recognise, not enough to leak to a shoulder-surfer. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  return `${user[0]}${"*".repeat(Math.max(1, Math.min(user.length - 1, 3)))}@${domain}`;
}

export function VerifyForm({
  email,
  needsResend = false,
  invite,
}: {
  email: string;
  needsResend?: boolean;
  /** Set when they arrived from an invitation. They are joining somebody
   *  else's shop, so onboarding — which creates a shop — is the wrong place. */
  invite?: string;
}) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState<string | null>(
    needsResend ? "We couldn't send your code just then. Tap resend to try again." : null,
  );
  const [busy, setBusy] = useState(false);
  // If the first send failed there is nothing to wait for; let them resend now.
  const [cooldown, setCooldown] = useState(needsResend ? 0 : RESEND_COOLDOWN);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((d) => d.map((v, i) => (i === index ? "" : v)));
      return;
    }
    // A pasted code lands in whichever box has focus; spread it across the rest
    // rather than making someone type six digits they already have.
    const next = [...digits];
    for (let i = 0; i < clean.length && index + i < LENGTH; i++) {
      next[index + i] = clean[i]!;
    }
    setDigits(next);
    const landed = Math.min(index + clean.length, LENGTH - 1);
    inputs.current[landed]?.focus();

    if (next.every(Boolean)) void submit(next.join(""));
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  async function submit(code: string) {
    if (busy) return;
    setBusy(true);
    setError(null);

    const { error: verifyError } = await authClient.emailOtp.verifyEmail({ email, otp: code });

    if (verifyError) {
      setError("That code isn't right, or it has expired. Ask for a new one.");
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
      setBusy(false);
      return;
    }

    router.push(invite ? `/invite/${encodeURIComponent(invite)}` : "/onboarding");
    router.refresh();
  }

  async function resend() {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN);
    setError(null);
    await authClient.emailOtp
      .sendVerificationOtp({ email, type: "email-verification" })
      .catch(() => setError("We couldn't send another code just now. Try again in a moment."));
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight">Check your email</h1>
      <p className="text-muted mt-2 text-sm">
        We sent a 6-digit code to <span className="text-text font-medium">{maskEmail(email)}</span>.
      </p>

      <div className="mt-8 flex gap-2" role="group" aria-label="Verification code">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            // inputMode numeric brings up the number pad without the spinner
            // arrows and validation quirks of type="number".
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={LENGTH}
            aria-label={`Digit ${index + 1}`}
            value={digit}
            disabled={busy}
            onChange={(e) => setDigit(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            onFocus={(e) => e.target.select()}
            className={cn(
              "bg-surface border-border-input h-14 w-full rounded-lg border text-center",
              "font-mono text-xl transition-colors duration-(--bh-duration-fast)",
              "hover:border-border-strong focus:border-accent",
              "disabled:opacity-60",
              error && "border-danger",
            )}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}

      {busy ? (
        <p className="text-muted mt-3 flex items-center gap-2 text-sm">
          <Loader2 className="size-3.5 animate-spin" />
          Checking your code
        </p>
      ) : null}

      <div className="mt-8 flex items-center gap-4">
        <Button variant="secondary" size="sm" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </Button>
        <a
          href="/signup"
          className="text-muted hover:text-text text-sm underline underline-offset-4"
        >
          Use a different email
        </a>
      </div>
    </div>
  );
}
