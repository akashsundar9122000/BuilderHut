"use server";

import { requireActor } from "@/lib/auth/session";
import { acceptInvitation, type AcceptResult } from "@/lib/team/service";

export async function acceptInvitationAction(token: string): Promise<AcceptResult> {
  const actor = await requireActor();
  return acceptInvitation(token, { id: actor.userId, email: actor.email });
}
