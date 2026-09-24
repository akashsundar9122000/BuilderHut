import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lt, ne } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { customers, customerSessions } from "@/lib/db/schema";
import { withTenant, type TenantDb } from "@/lib/db/tenant";
import { isSecureRequest } from "@/lib/http/secure-request";

/*
 * Storefront customer sessions.
 *
 * Hand-rolled rather than a second Better Auth instance, for the reason the top
 * of lib/db/schema/customers.ts gives: that library assumes a globally unique
 * email and here it is unique per store, which is the opposite assumption. This
 * is the ~200 lines that avoids fighting it.
 *
 * Two rules shape every signature below.
 *
 * 1. withTenant() throws when nested, because the production pool holds one
 *    connection and the inner call would wait forever on the outer one. Locally
 *    the pool is five and the mistake passes. So the primitives take the
 *    caller's TenantDb, and only the entry points at the bottom open one.
 *
 * 2. A cookie cannot be written once rendering has begun. getCustomer() is
 *    therefore strictly read-only, and every write happens in a server action or
 *    a route handler, after the transaction has closed.
 */

/** The row's expiry. The authority on whether a session is still good. */
const SESSION_DAYS = 30;

/*
 * The cookie outlives the row deliberately.
 *
 * If the cookie expired first, a session still valid in the database would
 * vanish from the browser and read as being signed out early. The other way
 * round is harmless: an opaque token whose row has gone simply resolves to null,
 * which is exactly what being signed out means.
 */
const COOKIE_DAYS = 60;

/** How stale a row may get before the sliding refresh extends it. */
const SLIDE_AFTER_HOURS = 24;

/**
 * Per store, exactly like bh_cart_<tenantId>.
 *
 * A visitor shopping at two BuilderHut shops holds two unrelated sessions, and
 * neither shop can see that the other exists. One shared cookie name would link
 * them, which is the leak this whole realm is arranged to prevent.
 */
function cookieName(tenantId: string): string {
  return `bh_cust_${tenantId}`;
}

/**
 * SHA-256 of the cookie value, as the schema comment promises.
 *
 * Unsalted is right here and would be wrong for a six-digit code: this is 32
 * random bytes, so there is no dictionary to precompute. What it buys is that a
 * database dump contains no usable cookie.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CustomerSession {
  sessionId: string;
  customerId: string;
  tenantId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Derived from passwordHash being set. The hash itself never leaves the row. */
  hasPassword: boolean;
  expiresAt: Date;
}

/* ── primitives: these take the caller's open transaction ───────────────── */

export async function createSession(
  db: TenantDb,
  customerId: string,
  request?: { ip?: string | null; userAgent?: string | null },
): Promise<{ sessionId: string; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  const [row] = await db.insert(customerSessions, {
    customerId,
    tokenHash: hashToken(token),
    expiresAt,
    ipAddress: request?.ip ?? null,
    userAgent: request?.userAgent ?? null,
  });
  if (!row) throw new Error("customer session insert returned no row");

  await db.update(customers, { lastLoginAt: new Date() }, eq(customers.id, customerId));
  return { sessionId: row.id, token, expiresAt };
}

/**
 * Resolve a cookie value to whoever holds it.
 *
 * The customer is joined in the same statement rather than fetched after: one
 * round trip, and there is no window in which the session exists and the person
 * it belongs to has been deleted underneath it.
 */
export async function loadSession(db: TenantDb, token: string): Promise<CustomerSession | null> {
  if (!token) return null;

  const rows = await db
    .select(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(
      and(
        eq(customerSessions.tokenHash, hashToken(token)),
        // A closed account keeps its rows for the merchant's order history, but
        // nobody signs into it.
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0] as
    | {
        customer_sessions: typeof customerSessions.$inferSelect;
        customers: typeof customers.$inferSelect;
      }
    | undefined;
  if (!row) return null;

  const session = row.customer_sessions;
  const customer = row.customers;
  // Expiry is checked here rather than in SQL so an expired row can be swept by
  // the nightly purge instead of lingering as a silent almost-match.
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return {
    sessionId: session.id,
    customerId: customer.id,
    tenantId: customer.tenantId,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    emailVerified: customer.emailVerified,
    phoneVerified: customer.phoneVerified,
    hasPassword: customer.passwordHash !== null,
    expiresAt: session.expiresAt,
  };
}

/**
 * Extend a session that is being used.
 *
 * Throttled to once a day, so a browsing session costs one extra UPDATE per day
 * rather than one per page. Returns the new expiry, or null when it was too soon
 * to bother. Only ever called from an action — a render must not write.
 */
export async function touchSession(
  db: TenantDb,
  session: CustomerSession,
): Promise<Date | null> {
  const remaining = session.expiresAt.getTime() - Date.now();
  const full = SESSION_DAYS * 86_400_000;
  if (full - remaining < SLIDE_AFTER_HOURS * 3_600_000) return null;

  const expiresAt = new Date(Date.now() + full);
  await db.update(customerSessions, { expiresAt }, eq(customerSessions.id, session.sessionId));
  return expiresAt;
}

export async function revokeSession(db: TenantDb, sessionId: string): Promise<void> {
  await db.delete(customerSessions, eq(customerSessions.id, sessionId));
}

/**
 * Sign out everywhere.
 *
 * What a password reset does, because a reset is what somebody does when they
 * think another person has their password — leaving that person's session alive
 * would make the reset theatre.
 */
export async function revokeAllSessions(
  db: TenantDb,
  customerId: string,
  keepSessionId?: string,
): Promise<number> {
  const where = keepSessionId
    ? and(eq(customerSessions.customerId, customerId), ne(customerSessions.id, keepSessionId))!
    : eq(customerSessions.customerId, customerId);
  const gone = await db.delete(customerSessions, where);
  return gone.length;
}

export async function purgeExpiredSessions(db: TenantDb): Promise<number> {
  const gone = await db.delete(customerSessions, lt(customerSessions.expiresAt, new Date()));
  return gone.length;
}

/* ── entry points: these open a transaction. Never call from inside one. ─── */

/** Reads the cookie only, so it is safe anywhere — including inside a transaction. */
export async function readSessionToken(tenantId: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(cookieName(tenantId))?.value ?? null;
}

/**
 * Who is signed in at this store, if anybody.
 *
 * React cache() keys on the argument, so a layout, a header and a page all
 * asking cost one transaction between them — the same reasoning as getActor() in
 * lib/auth/session.ts. Not unstable_cache: that is shared between requests, and
 * a session must never be.
 */
export const getCustomer = cache(async (tenantId: string): Promise<CustomerSession | null> => {
  const token = await readSessionToken(tenantId);
  if (!token) return null;
  return withTenant({ tenantId, actorId: tenantId, role: "staff" }, (db) =>
    loadSession(db, token),
  );
});

/**
 * Signed in, or somewhere else.
 *
 * Redirects rather than throwing, for the reason requireActor() gives: a layout
 * and its page render in parallel, so a throw surfaces as a 500 before the
 * redirect has a chance to land. Sends them to the SHOP's own sign-in page, not
 * BuilderHut's.
 */
export async function requireCustomer(
  tenantId: string,
  slug: string,
  next?: string,
): Promise<CustomerSession> {
  const customer = await getCustomer(tenantId);
  if (customer) return customer;
  const target = next ? `?next=${encodeURIComponent(next)}` : "";
  redirect(`/s/${slug}/login${target}`);
}

export async function writeSessionCookie(tenantId: string, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(tenantId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: COOKIE_DAYS * 86_400,
  });
}

export async function clearSessionCookie(tenantId: string): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName(tenantId));
}

/** Sign out on this device: the row goes, then the cookie. */
export async function logoutCustomer(tenantId: string): Promise<void> {
  const token = await readSessionToken(tenantId);
  if (token) {
    await withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
      const session = await loadSession(db, token);
      if (session) await revokeSession(db, session.sessionId);
    });
  }
  await clearSessionCookie(tenantId);
}

/** What createSession wants to record, read from the request. */
export async function requestFingerprint(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null,
    userAgent: h.get("user-agent"),
  };
}
