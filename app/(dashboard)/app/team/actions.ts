"use server";

import { revalidatePath } from "next/cache";

import { requireActor, runForTenant } from "@/lib/auth/session";
import {
  inviteMember,
  removeMember,
  revokeInvitation,
  setMemberRole,
  type InviteResult,
  type MemberChangeResult,
} from "@/lib/team/service";
import { isMemberRole } from "@/lib/team/roles";

/*
 * Only the owner and admins change who can act for a shop.
 *
 * Checked here rather than only in the UI: these are the actions that decide
 * who else can read a merchant's orders, so "the button wasn't shown" is not
 * a control.
 */
async function requireManager(): Promise<
  { ok: true; tenantId: string } | { ok: false; message: string }
> {
  const actor = await requireActor();
  if (!actor.tenantId) return { ok: false, message: "You don't have a shop yet." };
  if (actor.role !== "owner" && actor.role !== "admin") {
    return { ok: false, message: "Only the owner and admins can change who works here." };
  }
  return { ok: true, tenantId: actor.tenantId };
}

export async function inviteMemberAction(email: string, role: string): Promise<InviteResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  if (!isMemberRole(role)) return { ok: false, message: "Pick a role." };

  const actor = await requireActor();
  const result = await runForTenant((db) => inviteMember(db, email, role, actor.userId));
  if (result.ok) revalidatePath("/app/team");
  return result;
}

export async function revokeInvitationAction(id: string): Promise<MemberChangeResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate;

  await runForTenant((db) => revokeInvitation(db, id));
  revalidatePath("/app/team");
  return { ok: true };
}

export async function setMemberRoleAction(
  userId: string,
  role: string,
): Promise<MemberChangeResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate;
  if (!isMemberRole(role)) return { ok: false, message: "Pick a role." };

  const result = await runForTenant((db) => setMemberRole(db, userId, role));
  if (result.ok) revalidatePath("/app/team");
  return result;
}

export async function removeMemberAction(userId: string): Promise<MemberChangeResult> {
  const gate = await requireManager();
  if (!gate.ok) return gate;

  const result = await runForTenant((db) => removeMember(db, userId));
  if (result.ok) revalidatePath("/app/team");
  return result;
}
