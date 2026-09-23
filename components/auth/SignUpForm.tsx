"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button, Field, Input } from "@/components/ui";

export function SignUpForm({
  invite,
  email: invitedEmail,
}: {
  /** An invitation token, carried through to /verify so the code screen can
   *  hand the new member back to the shop that invited them. */
  invite?: string;
  email?: string;
} = {}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /** Checked here for the instant feedback; the server checks again regardless. */
  function validate() {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Tell us what to call you.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = "That doesn't look like an email address.";
    if (password.length < 10) next.password = "Use at least 10 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setErrors({});

    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setErrors({
        form:
          error.status === 422
            ? "An account already exists for that email. Try signing in instead."
            : (error.message ?? "We couldn't create your account. Please try again."),
      });
      setBusy(false);
      return;
    }

    /*
     * Send the code, then hand over to the verify screen.
     *
     * The account already exists at this point, so nothing here may prevent the
     * redirect. Letting a rejection escape left the button spinning forever on
     * a page that had already succeeded — the worst possible outcome, because
     * the only recovery was for the user to guess that signing in would work.
     *
     * The failure is still reported rather than swallowed: /verify offers a
     * resend, and ?resend=1 tells it to say so instead of waiting silently for
     * a code that was never sent.
     */
    let sendFailed = false;
    try {
      const sent = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "email-verification",
      });
      if (sent.error) {
        sendFailed = true;
        console.error("[signup] could not send the verification code", sent.error);
      }
    } catch (error) {
      sendFailed = true;
      console.error("[signup] sending the verification code threw", error);
    }

    let next = `/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`;
    if (invite) next += `&invite=${encodeURIComponent(invite)}`;
    router.push(sendFailed ? `${next}&resend=1` : next);
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight">Create your store</h1>
      <p className="text-muted mt-2 text-sm">
        Free to build. You only need a domain when you&rsquo;re ready to be found.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <Field label="Your name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            placeholder="Harshini"
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            placeholder="you@example.com"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 10 characters."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
          />
        </Field>

        {errors.form ? (
          <p role="alert" className="text-danger bg-danger-soft rounded-md px-3 py-2 text-sm">
            {errors.form}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={busy} className="mt-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Creating your account" : "Create my store"}
        </Button>
      </form>

      <p className="text-muted mt-6 text-sm">
        Already have a store?{" "}
        <Link href="/login" className="text-accent hover:text-accent-hover underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
