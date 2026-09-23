import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "./merchant";
import { getRootDb } from "@/lib/db/client";
import { tenantMembers, tenants } from "@/lib/db/schema";
import { withTenant, type ActorRole, type TenantDb } from "@/lib/db/tenant";

/*
 * Turns a session cookie into an authorized actor, and an actor into database
 * access. This is the only path feature code should use to reach merchant data.
 *
 * The rule the blueprint states twice and this file enforces: the tenant is
 * never taken from the request. It comes from the session, checked against a
 * membership row, every time.
 */

export interface Actor {
  userId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  /** The store this request acts for. Null before onboarding creates one. */
  tenantId: string | null;
  role: ActorRole | null;
  tenantSlug: string | null;
  tenantName: string | null;
}

/**
 * React's `cache` dedupes this per request, so a layout, a page and three
 * components asking "who is this?" cost one session lookup and one membership
 * query rather than eight.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & { isPlatformAdmin?: boolean };
  const activeTenantId = (session.session as { activeTenantId?: string | null })
    .activeTenantId;

  const base: Actor = {
    userId: user.id,
    email: user.email,
    name: user.name,
    isPlatformAdmin: user.isPlatformAdmin === true,
    tenantId: null,
    role: null,
    tenantSlug: null,
    tenantName: null,
  };

  const db = getRootDb();

  /*
   * The membership row is the authorization, not the session field.
   *
   * activeTenantId is a preference — which of my stores am I looking at. It is
   * still joined against tenant_members here, so a stale or tampered value
   * resolves to nothing rather than to access. If it no longer resolves, fall
   * back to any membership the user genuinely holds.
   */
  const rows = await db
    .select({
      tenantId: tenantMembers.tenantId,
      role: tenantMembers.role,
      slug: tenants.slug,
      name: tenants.name,
      status: tenants.status,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(
      activeTenantId
        ? and(eq(tenantMembers.userId, user.id), eq(tenantMembers.tenantId, activeTenantId))
        : eq(tenantMembers.userId, user.id),
    )
    .limit(1);

  const membership =
    rows[0] ??
    (activeTenantId
      ? (
          await db
            .select({
              tenantId: tenantMembers.tenantId,
              role: tenantMembers.role,
              slug: tenants.slug,
              name: tenants.name,
              status: tenants.status,
            })
            .from(tenantMembers)
            .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
            .where(eq(tenantMembers.userId, user.id))
            .limit(1)
        )[0]
      : undefined);

  if (!membership) return base;

  // A suspended store is not accessible to its own merchant. Platform admins
  // reach it through /admin, which does not go through this path.
  if (membership.status !== "active") return base;

  return {
    ...base,
    tenantId: membership.tenantId,
    role: membership.role as ActorRole,
    tenantSlug: membership.slug,
    tenantName: membership.name,
  };
});

/*
 * Redirects rather than throws.
 *
 * A layout and its page render in parallel, so a page calling this cannot rely
 * on the layout's own redirect having happened first — it would throw and
 * surface as a 500 before the redirect landed. redirect() is the idiomatic
 * control flow here and behaves correctly from pages and server actions alike.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

/**
 * The merchant-facing database door.
 *
 * Resolves the actor, then opens a tenant-scoped transaction for them. Feature
 * code never constructs a TenantContext by hand, which is what makes "pass the
 * tenant id from the browser" impossible to write by accident.
 */
export async function runForTenant<T>(fn: (db: TenantDb) => PromiseLike<T>): Promise<T> {
  const actor = await requireActor();
  // Signed in but no store yet: onboarding is the only place to go.
  if (!actor.tenantId || !actor.role) redirect("/onboarding");
  return withTenant(
    { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role },
    fn,
  );
}

/** Coarse role gate. Real decisions belong in the service, against the resource. */
const RANK: Record<ActorRole, number> = {
  staff: 1,
  manager: 2,
  admin: 3,
  owner: 4,
  platform_admin: 5,
};

export function hasAtLeast(actor: Actor, role: ActorRole): boolean {
  if (actor.isPlatformAdmin) return true;
  if (!actor.role) return false;
  return RANK[actor.role] >= RANK[role];
}
