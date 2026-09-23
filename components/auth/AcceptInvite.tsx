"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui";
import { acceptInvitationAction } from "@/app/(auth)/invite/[token]/actions";

/*
 * The accept button.
 *
 * The mismatch is called out before they press anything: being told "that
 * invitation was sent to someone@else.com" after clicking is worse than being
 * told which account you are signed in as beforehand.
 */
export function AcceptInvite({
  token,
  invitedEmail,
  signedInAs,
}: {
  token: string;
  invitedEmail: string;
  signedInAs: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const mismatch = invitedEmail.toLowerCase() !== signedInAs.toLowerCase();

  return (
    <div className="mt-6 flex flex-col gap-3">
      {mismatch ? (
        <p className="text-warning bg-warning-soft rounded-md px-3 py-2 text-sm leading-relaxed">
          This invitation was sent to <strong>{invitedEmail}</strong>, and you&rsquo;re signed in
          as {signedInAs}. Sign in as {invitedEmail} to accept it.
        </p>
      ) : (
        <p className="text-muted text-sm">
          You&rsquo;re signed in as {signedInAs}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={pending || mismatch}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await acceptInvitationAction(token);
              if (result.ok) router.push("/app");
              else setError(result.message);
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Accept and open the shop
        </Button>
        <Button variant="ghost" size="lg" onClick={() => router.push("/login")}>
          Sign in as somebody else
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
