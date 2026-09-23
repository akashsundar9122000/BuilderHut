import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AcceptInvite } from "@/components/auth/AcceptInvite";
import { Button } from "@/components/ui";
import { getActor } from "@/lib/auth/session";
import { ROLE_BLURBS, ROLE_LABELS } from "@/lib/team/roles";
import { previewInvitation } from "@/lib/team/service";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

/*
 * Accepting an invitation.
 *
 * Three states, all of which happen: the link is dead, the visitor has no
 * account yet, or they are signed in as somebody. The third is the only one
 * that can accept, and it still has to match the address the invitation was
 * sent to — otherwise forwarding the email hands somebody else a shop.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await previewInvitation(token);

  if (!invitation) {
    return (
      <Shell title="That invitation isn't valid">
        <p className="text-muted text-sm leading-relaxed">
          It may have been used already, cancelled, or simply expired — invitations last three
          days. Ask whoever invited you to send another.
        </p>
        <Button asChild variant="secondary" className="mt-6">
          <Link href="/">BuilderHut home</Link>
        </Button>
      </Shell>
    );
  }

  const actor = await getActor();

  if (!actor) {
    /*
     * Straight to signup with the address filled in, rather than a page
     * explaining that they need an account. They came from an email that told
     * them to click a link; making them read a second page first is friction
     * for nothing.
     */
    redirect(
      `/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.email)}`,
    );
  }

  return (
    <Shell title={`Help run ${invitation.shopName}`}>
      <p className="text-muted text-sm leading-relaxed">
        You&rsquo;ve been invited as {ROLE_LABELS[invitation.role].toLowerCase()} —{" "}
        {ROLE_BLURBS[invitation.role].toLowerCase()}
      </p>
      <AcceptInvite token={token} invitedEmail={invitation.email} signedInAs={actor.email} />
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-display text-text text-3xl leading-tight">{title}</h1>
      <div className="mt-4">{children}</div>
    </main>
  );
}
