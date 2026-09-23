import "server-only";

import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import { auditLogs, tenantInvitations, tenantMembers, tenants, users } from "@/lib/db/schema";
import type { TenantDb } from "@/lib/db/tenant";
import { sendEmail } from "@/lib/email/provider";
import { invitationEmail } from "@/lib/email/templates";
import { EntitlementError, requireCapacity } from "@/lib/plans/entitlements";
import type { MemberRole } from "./roles";

/*
 * Who else can run this shop.
 *
 * Blueprint section 2.3's roles have existed in the schema since Phase 0 —
 * only `owner` was ever created, because retrofitting RBAC over a single-role
 * assumption means touching every authorization check. This exposes them.
 *
 * Both tables here are PLATFORM-classified, so every query names its tenant
 * explicitly: they have to be readable before a tenant context exists, which
 * is exactly the situation somebody accepting an invitation is in.
 */

const INVITE_TTL_HOURS = 72;

export interface Member {
  userId: string;
  name: string | null;
  email: string;
  role: MemberRole;
  joinedAt: Date;
  /** True for the person looking at the screen. */
  isYou: boolean;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  invitedAt: Date;
  expiresAt: Date;
  expired: boolean;
}

export async function listTeam(
  tenantId: string,
  viewerId: string,
): Promise<{ members: Member[]; invitations: PendingInvitation[] }> {
  const db = getRootDb();

  const [memberRows, inviteRows] = await Promise.all([
    db
      .select({
        userId: tenantMembers.userId,
        role: tenantMembers.role,
        joinedAt: tenantMembers.createdAt,
        name: users.name,
        email: users.email,
      })
      .from(tenantMembers)
      .innerJoin(users, eq(users.id, tenantMembers.userId))
      .where(eq(tenantMembers.tenantId, tenantId))
      .orderBy(tenantMembers.createdAt),
    db
      .select()
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          isNull(tenantInvitations.acceptedAt),
          isNull(tenantInvitations.revokedAt),
        ),
      )
      .orderBy(desc(tenantInvitations.createdAt)),
  ]);

  const now = Date.now();
  return {
    members: memberRows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role,
      joinedAt: row.joinedAt,
      isYou: row.userId === viewerId,
    })),
    invitations: inviteRows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      invitedAt: row.createdAt,
      expiresAt: row.expiresAt,
      expired: row.expiresAt.getTime() < now,
    })),
  };
}

export type InviteResult = { ok: true } | { ok: false; message: string };

/**
 * Invite somebody, by email.
 *
 * The plan's ceiling counts members AND live invitations, because otherwise a
 * shop on a two-person plan can invite nine people and discover the problem
 * when they all try to accept.
 */
export async function inviteMember(
  db: TenantDb,
  email: string,
  role: MemberRole,
  invitedBy: string,
): Promise<InviteResult> {
  const address = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
    return { ok: false, message: "That doesn't look like an email address." };
  }
  if (role === "owner") {
    // Ownership transfers; it is not handed out. Doing it by invitation would
    // mean a shop could quietly acquire a second owner who can remove the first.
    return { ok: false, message: "A shop has one owner. Invite them as an admin instead." };
  }

  const tenantId = db.ctx.tenantId;
  const root = getRootDb();

  const existing = await root
    .select({ userId: tenantMembers.userId })
    .from(tenantMembers)
    .innerJoin(users, eq(users.id, tenantMembers.userId))
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(users.email, address)))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, message: `${address} is already on this shop.` };
  }

  try {
    await requireCapacity(db, "staff", 1 + (await pendingCount(tenantId)));
  } catch (error) {
    if (error instanceof EntitlementError) return { ok: false, message: error.message };
    throw error;
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  /*
   * One live invitation per address per shop. Re-inviting replaces the row, so
   * a link that was revoked cannot be resurrected by sending a second one, and
   * the merchant does not accumulate a list of stale invitations they have to
   * tidy up.
   */
  await root
    .insert(tenantInvitations)
    .values({ id: uuidv7(), tenantId, email: address, role, token, invitedBy, expiresAt })
    .onConflictDoUpdate({
      target: [tenantInvitations.tenantId, tenantInvitations.email],
      set: { role, token, invitedBy, expiresAt, acceptedAt: null, revokedAt: null, updatedAt: new Date() },
    });

  const [shop] = await root
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const base = process.env.APP_URL ?? "http://localhost:3000";
  await sendEmail(invitationEmail(address, shop?.name ?? "a shop", `${base}/invite/${token}`));

  await writeAudit(db, "team.invited", { email: address, role });
  return { ok: true };
}

async function pendingCount(tenantId: string): Promise<number> {
  const rows = await getRootDb()
    .select({ id: tenantInvitations.id })
    .from(tenantInvitations)
    .where(
      and(
        eq(tenantInvitations.tenantId, tenantId),
        isNull(tenantInvitations.acceptedAt),
        isNull(tenantInvitations.revokedAt),
      ),
    );
  return rows.length;
}

export async function revokeInvitation(db: TenantDb, invitationId: string): Promise<void> {
  await getRootDb()
    .update(tenantInvitations)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    // Scoped by tenant as well as id: the id comes from a browser.
    .where(
      and(
        eq(tenantInvitations.id, invitationId),
        eq(tenantInvitations.tenantId, db.ctx.tenantId),
      ),
    );
  await writeAudit(db, "team.invitation_revoked", { invitationId });
}

export interface InvitationPreview {
  shopName: string;
  email: string;
  role: MemberRole;
}

/** What the invitee sees before deciding, looked up by the token alone. */
export async function previewInvitation(token: string): Promise<InvitationPreview | null> {
  const rows = await getRootDb()
    .select({
      email: tenantInvitations.email,
      role: tenantInvitations.role,
      expiresAt: tenantInvitations.expiresAt,
      acceptedAt: tenantInvitations.acceptedAt,
      revokedAt: tenantInvitations.revokedAt,
      shopName: tenants.name,
    })
    .from(tenantInvitations)
    .innerJoin(tenants, eq(tenants.id, tenantInvitations.tenantId))
    .where(eq(tenantInvitations.token, token))
    .limit(1);

  const row = rows[0];
  if (!row || row.acceptedAt || row.revokedAt || row.expiresAt.getTime() < Date.now()) return null;
  return { shopName: row.shopName, email: row.email, role: row.role };
}

export type AcceptResult =
  | { ok: true; tenantId: string }
  | { ok: false; message: string };

/**
 * Accept an invitation.
 *
 * Matched on the signed-in user's email, not only on the token — otherwise
 * forwarding the link hands someone else access to a shop. The whole thing is
 * one transaction on the root connection: the invitation is marked used and
 * the membership created together, so a failure cannot leave a consumed
 * invitation with no membership behind it.
 */
export async function acceptInvitation(
  token: string,
  user: { id: string; email: string },
): Promise<AcceptResult> {
  const root = getRootDb();

  return root.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.token, token))
      .for("update")
      .limit(1);

    if (!invite || invite.revokedAt) {
      return { ok: false, message: "That invitation is no longer valid." };
    }
    if (invite.acceptedAt) {
      return { ok: false, message: "That invitation has already been used." };
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return { ok: false, message: "That invitation has expired. Ask for a new one." };
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return {
        ok: false,
        message: `That invitation was sent to ${invite.email}. Sign in as that address to accept it.`,
      };
    }

    await tx
      .insert(tenantMembers)
      .values({
        id: uuidv7(),
        tenantId: invite.tenantId,
        userId: user.id,
        role: invite.role,
        invitedBy: invite.invitedBy,
        acceptedAt: new Date(),
      })
      .onConflictDoNothing({ target: [tenantMembers.tenantId, tenantMembers.userId] });

    await tx
      .update(tenantInvitations)
      .set({ acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(tenantInvitations.id, invite.id));

    await tx.insert(auditLogs).values({
      id: uuidv7(),
      tenantId: invite.tenantId,
      actorId: user.id,
      actorRole: invite.role,
      action: "team.joined",
      entityType: "tenant_member",
      entityId: invite.tenantId,
      metadata: { email: invite.email, role: invite.role },
    });

    return { ok: true, tenantId: invite.tenantId };
  });
}

export type MemberChangeResult = { ok: true } | { ok: false; message: string };

export async function setMemberRole(
  db: TenantDb,
  userId: string,
  role: MemberRole,
): Promise<MemberChangeResult> {
  if (role === "owner") {
    return { ok: false, message: "A shop has one owner, and ownership is transferred, not granted." };
  }

  const root = getRootDb();
  const [member] = await root
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(
      and(eq(tenantMembers.tenantId, db.ctx.tenantId), eq(tenantMembers.userId, userId)),
    )
    .limit(1);

  if (!member) return { ok: false, message: "That person isn't on this shop." };
  if (member.role === "owner") {
    // Demoting the owner would leave a shop nobody can administer.
    return { ok: false, message: "The owner's role can't be changed here." };
  }

  await root
    .update(tenantMembers)
    .set({ role, updatedAt: new Date() })
    .where(and(eq(tenantMembers.tenantId, db.ctx.tenantId), eq(tenantMembers.userId, userId)));

  await writeAudit(db, "team.role_changed", { userId, role });
  return { ok: true };
}

export async function removeMember(db: TenantDb, userId: string): Promise<MemberChangeResult> {
  const root = getRootDb();
  const [member] = await root
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, db.ctx.tenantId), eq(tenantMembers.userId, userId)))
    .limit(1);

  if (!member) return { ok: false, message: "That person isn't on this shop." };
  if (member.role === "owner") {
    return { ok: false, message: "The owner can't be removed from their own shop." };
  }
  if (userId === db.ctx.actorId) {
    // Leaving is a different action with a different confirmation. Removing
    // yourself from the team screen by accident is not recoverable from here.
    return { ok: false, message: "You can't remove yourself." };
  }

  await root
    .delete(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, db.ctx.tenantId), eq(tenantMembers.userId, userId)));

  await writeAudit(db, "team.removed", { userId });
  return { ok: true };
}

async function writeAudit(
  db: TenantDb,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await db.raw.insert(auditLogs).values({
    id: uuidv7(),
    tenantId: db.ctx.tenantId,
    actorId: db.ctx.actorId,
    actorRole: db.ctx.role,
    action,
    entityType: "tenant_member",
    entityId: db.ctx.tenantId,
    metadata,
  });
}
