"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { authClient } from "@/lib/auth/client";
import { Button, Field, Input } from "@/components/ui";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        // One message for both "no such account" and "wrong password". Telling
        // them apart hands an attacker a free way to enumerate who has an account.
        setError(
          signInError.status === 429
            ? "Too many attempts just now. Wait a moment and try again."
            : "That email and password don't match an account.",
        );
        setBusy(false);
        return;
      }
    } catch {
      // A thrown error must still release the button, or the form is dead.
      setError("We couldn't reach the server. Check your connection and try again.");
      setBusy(false);
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight">Welcome back</h1>
      <p className="text-muted mt-2 text-sm">Sign in to manage your store.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error ? (
          <p role="alert" className="text-danger bg-danger-soft rounded-md px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={busy} className="mt-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <p className="text-muted mt-6 text-sm">
        New here?{" "}
        <Link href="/signup" className="text-accent hover:text-accent-hover underline underline-offset-4">
          Create a store
        </Link>
      </p>
    </div>
  );
}
