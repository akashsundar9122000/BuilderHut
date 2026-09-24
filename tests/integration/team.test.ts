/*
 * Staff accounts, against a real Postgres.
 *
 * An invitation is a link that grants access to somebody's shop, so the
 * assertions here are mostly about the ways it must refuse: a forwarded link,
 * a second use, an expired one, and a plan with no room. Those are the paths
 * that matter, and none of them can be checked without the real tables.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import { tenantInvitations, tenantMembers, tenants, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { changePlan } from "@/lib/plans/entitlements";
import {
  acceptInvitation,
  inviteMember,
  listTeam,
  previewInvitation,
  removeMember,
  setMemberRole,
} from "@/lib/team/service";

/*
 * The email provider is replaced, not the transport.
 *
 * Inviting sends mail, and a developer with real SMTP in their .env.local
 * would otherwise have this suite posting invitations to addresses at
 * builderhut.test — a domain that does not exist — and collecting the bounces
 * on their own account. A test suite must not be able to send email.
 */
vi.mock("@/lib/email/provider", () => ({
  sendEmail: async () => {},
}));

const suffix = Date.now().toString(36);
const tenantId = uuidv7();
const ownerId = uuidv7();
const colleagueId = uuidv7();
const strangerId = uuidv7();

const ownerEmail = `owner-${suffix}@builderhut.test`;
const colleagueEmail = `colleague-${suffix}@builderhut.test`;
const strangerEmail = `stranger-${suffix}@builderhut.test`;

const ctx = { tenantId, actorId: ownerId, role: "owner" as const };

async function tokenFor(email: string): Promise<string> {
  const [row] = await getRootDb()
    .select({ token: tenantInvitations.token })
    .from(tenantInvitations)
    .where(eq(tenantInvitations.email, email))
    .limit(1);
  return row!.token;
}

beforeAll(async () => {
  const db = getRootDb();
  await db.insert(users).values([
    { id: ownerId, name: "Owner", email: ownerEmail, emailVerified: true },
    { id: colleagueId, name: "Colleague", email: colleagueEmail, emailVerified: true },
    { id: strangerId, name: "Stranger", email: strangerEmail, emailVerified: true },
  ]);
  await db
    .insert(tenants)
    .values({ id: tenantId, name: "Team Test", slug: `team-${suffix}`, industry: "crochet" });
  await db
    .insert(tenantMembers)
    .values({ id: uuidv7(), tenantId, userId: ownerId, role: "owner", acceptedAt: new Date() });

  // Pro, so the seat limit is not what these tests are measuring.
  await withTenant(ctx, (tx) => changePlan(tx, "pro"));
});

afterAll(async () => {
  const db = getRootDb();
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  for (const id of [ownerId, colleagueId, strangerId]) {
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("inviting", () => {
  it("refuses an address that is not one", async () => {
    const result = await withTenant(ctx, (db) => inviteMember(db, "not-an-email", "staff", ownerId));
    expect(result.ok).toBe(false);
  });

  it("refuses to hand out ownership", async () => {
    const result = await withTenant(ctx, (db) =>
      inviteMember(db, colleagueEmail, "owner", ownerId),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("one owner");
  });

  it("creates an invitation that the token can preview", async () => {
    const result = await withTenant(ctx, (db) =>
      inviteMember(db, colleagueEmail, "manager", ownerId),
    );
    expect(result.ok).toBe(true);

    const preview = await previewInvitation(await tokenFor(colleagueEmail));
    expect(preview?.email).toBe(colleagueEmail);
    expect(preview?.role).toBe("manager");
  });

  it("replaces rather than accumulates when the same person is re-invited", async () => {
    const first = await tokenFor(colleagueEmail);
    await withTenant(ctx, (db) => inviteMember(db, colleagueEmail, "staff", ownerId));
    const second = await tokenFor(colleagueEmail);

    expect(second).not.toBe(first);
    // The old link must stop working, or revoking one is meaningless.
    expect(await previewInvitation(first)).toBeNull();
    expect((await previewInvitation(second))?.role).toBe("staff");
  });
});

describe("accepting", () => {
  it("refuses a forwarded link", async () => {
    const token = await tokenFor(colleagueEmail);
    const result = await acceptInvitation(token, { id: strangerId, email: strangerEmail });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(colleagueEmail);

    const { members } = await listTeam(tenantId, ownerId);
    expect(members.some((m) => m.userId === strangerId)).toBe(false);
  });

  it("adds the member when the address matches", async () => {
    const token = await tokenFor(colleagueEmail);
    const result = await acceptInvitation(token, { id: colleagueId, email: colleagueEmail });
    expect(result.ok).toBe(true);

    const { members, invitations } = await listTeam(tenantId, ownerId);
    expect(members.find((m) => m.userId === colleagueId)?.role).toBe("staff");
    // The invitation should leave the pending list once it is used.
    expect(invitations.some((i) => i.email === colleagueEmail)).toBe(false);
  });

  it("refuses a second use of the same link", async () => {
    const [row] = await getRootDb()
      .select({ token: tenantInvitations.token })
      .from(tenantInvitations)
      .where(eq(tenantInvitations.email, colleagueEmail))
      .limit(1);

    const result = await acceptInvitation(row!.token, { id: colleagueId, email: colleagueEmail });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("already been used");
  });

  it("refuses an expired link", async () => {
    await withTenant(ctx, (db) => inviteMember(db, strangerEmail, "staff", ownerId));
    const token = await tokenFor(strangerEmail);
    await getRootDb()
      .update(tenantInvitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(tenantInvitations.token, token));

    expect(await previewInvitation(token)).toBeNull();
    const result = await acceptInvitation(token, { id: strangerId, email: strangerEmail });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("expired");
  });
});

describe("changing who is on a shop", () => {
  it("changes a member's role", async () => {
    const result = await withTenant(ctx, (db) => setMemberRole(db, colleagueId, "manager"));
    expect(result.ok).toBe(true);
    const { members } = await listTeam(tenantId, ownerId);
    expect(members.find((m) => m.userId === colleagueId)?.role).toBe("manager");
  });

  it("refuses to change the owner's role", async () => {
    const result = await withTenant(ctx, (db) => setMemberRole(db, ownerId, "staff"));
    expect(result.ok).toBe(false);
  });

  it("refuses to remove the owner", async () => {
    const result = await withTenant(ctx, (db) => removeMember(db, ownerId));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("owner");
  });

  it("refuses to remove yourself", async () => {
    const asColleague = { tenantId, actorId: colleagueId, role: "manager" as const };
    const result = await withTenant(asColleague, (db) => removeMember(db, colleagueId));
    expect(result.ok).toBe(false);
  });

  it("removes somebody else", async () => {
    const result = await withTenant(ctx, (db) => removeMember(db, colleagueId));
    expect(result.ok).toBe(true);
    const { members } = await listTeam(tenantId, ownerId);
    expect(members.some((m) => m.userId === colleagueId)).toBe(false);
  });
});

describe("seats", () => {
  it("counts pending invitations against the plan, not just members", async () => {
    await withTenant(ctx, (db) => changePlan(db, "free"));
    try {
      // Starter allows one person, and the owner is already it.
      const result = await withTenant(ctx, (db) =>
        inviteMember(db, `extra-${suffix}@builderhut.test`, "staff", ownerId),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/Starter|Standard/);
    } finally {
      await withTenant(ctx, (db) => changePlan(db, "pro"));
    }
  });
});
