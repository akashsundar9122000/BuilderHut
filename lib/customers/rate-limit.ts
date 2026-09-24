import "server-only";

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { customerRateLimits, customerVerifications } from "@/lib/db/schema";
import type { TenantDb } from "@/lib/db/tenant";
import { EntitlementError, requireFeature } from "@/lib/plans/entitlements";

/*
 * Rate limits for the storefront sign-in paths.
 *
 * Counters live in the database, not in a Map. This deploys serverless and fans
 * out, so an in-memory counter is per instance: with N warm instances the
 * effective limit is N times the intended one, and it resets on every cold start
 * — which is exactly when a scripted burst arrives, because the burst is what
 * causes the scale-out. It also cannot express "this store may send 100 texts a
 * day" at all, because the money is spent globally rather than per instance.
 *
 * The cost is one statement inside a transaction the caller already holds open.
 *
 * ONE RULE, and it is easy to break: never throw after take(). An exception
 * escaping withTenant() rolls the whole transaction back, counter included, and
 * a limiter that forgets failed attempts is not a limiter. Every caller in
 * lib/customers/auth.ts returns a result instead.
 */

const DAILY_SMS_CAP = Number(process.env.CUSTOMER_SMS_DAILY_CAP ?? 100);

export const LIMITS = {
  /*
   * Sends to one identifier. Generous on purpose: the comment in
   * lib/auth/merchant.ts is right that an IP is not a person and that the real
   * protection against guessing is the three-attempt cap on the code itself.
   */
  code_send: { max: 5, windowSeconds: 3_600 },
  code_verify: { max: 10, windowSeconds: 3_600 },
  password_attempt: { max: 10, windowSeconds: 900 },
  /** Per store, per day. A hard money cap behind the plan gate's braces. */
  sms_send_store: { max: Number.isFinite(DAILY_SMS_CAP) ? DAILY_SMS_CAP : 100, windowSeconds: 86_400 },
  email_send_store: { max: 500, windowSeconds: 86_400 },
} as const;

export type RateLimitKey = keyof typeof LIMITS;

export type LimitDecision =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number; message: string };

export type Refusal = { ok: false; message: string; retryAfterSeconds?: number };

function bucketFor(key: RateLimitKey, subject: string): string {
  return `${key}:${subject.toLowerCase()}`;
}

function refusal(key: RateLimitKey, retryAfterSeconds: number): LimitDecision {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const wait = minutes === 1 ? "a minute" : `${minutes} minutes`;
  const message =
    key === "sms_send_store"
      ? "This shop has sent all the text messages it can today. Try again tomorrow, or use an email address."
      : key === "email_send_store"
        ? "This shop has sent all the emails it can today. Please try again tomorrow."
        : key === "password_attempt"
          ? `Too many attempts. Try again in ${wait}.`
          : `We've sent you a few codes already. Try again in ${wait}.`;
  return { ok: false, retryAfterSeconds, message };
}

/**
 * Count one attempt against a bucket and say whether it is allowed.
 *
 * One statement: the upsert both rolls the window over and increments, so two
 * simultaneous requests serialise on the row lock rather than each reading a
 * stale count. Read-then-write in application code is how a limiter ends up
 * letting through twice what it should under exactly the load it exists for.
 */
export async function take(
  db: TenantDb,
  key: RateLimitKey,
  subject: string,
): Promise<LimitDecision> {
  const { max, windowSeconds } = LIMITS[key];
  const bucket = bucketFor(key, subject);
  const window = sql.raw(`interval '${windowSeconds} seconds'`);

  const rows = await db.unsafeRaw<{ count: number; window_started_at: Date }>(
    "The scoped builders have no onConflictDoUpdate, and read-then-write is exactly the race a rate limiter must not have.",
    sql`
      INSERT INTO ${customerRateLimits} ("id", "tenant_id", "bucket", "window_started_at", "count")
      VALUES (${uuidv7()}, ${db.ctx.tenantId}, ${bucket}, now(), 1)
      ON CONFLICT ("tenant_id", "bucket") DO UPDATE SET
        "count" = CASE
          WHEN ${customerRateLimits}."window_started_at" < now() - ${window} THEN 1
          ELSE ${customerRateLimits}."count" + 1
        END,
        "window_started_at" = CASE
          WHEN ${customerRateLimits}."window_started_at" < now() - ${window} THEN now()
          ELSE ${customerRateLimits}."window_started_at"
        END,
        "updated_at" = now()
      RETURNING "count", "window_started_at"
    `,
  );

  const row = rows[0];
  // No row back from a RETURNING upsert should be impossible; allowing the
  // request is the wrong side to fail on, so it refuses and says to retry.
  if (!row) return refusal(key, 60);

  if (row.count > max) {
    const elapsed = (Date.now() - new Date(row.window_started_at).getTime()) / 1000;
    return refusal(key, Math.max(1, Math.ceil(windowSeconds - elapsed)));
  }
  return { ok: true, remaining: max - row.count };
}

/** Decide without counting — for a pre-flight check before an expensive step. */
export async function peek(
  db: TenantDb,
  key: RateLimitKey,
  subject: string,
): Promise<LimitDecision> {
  const { max, windowSeconds } = LIMITS[key];
  const since = new Date(Date.now() - windowSeconds * 1000);
  const [row] = await db
    .select(customerRateLimits)
    .where(
      and(
        eq(customerRateLimits.bucket, bucketFor(key, subject)),
        gte(customerRateLimits.windowStartedAt, since),
      ),
    )
    .limit(1);

  if (!row || row.count < max) return { ok: true, remaining: max - (row?.count ?? 0) };
  const elapsed = (Date.now() - row.windowStartedAt.getTime()) / 1000;
  return refusal(key, Math.max(1, Math.ceil(windowSeconds - elapsed)));
}

/**
 * Forget a bucket after a success.
 *
 * Somebody who mistyped their password twice and then got it right is not a
 * threat, and leaving the count against them for the rest of the window means
 * their next honest mistake locks them out.
 */
export async function clear(db: TenantDb, key: RateLimitKey, subject: string): Promise<void> {
  await db.delete(customerRateLimits, eq(customerRateLimits.bucket, bucketFor(key, subject)));
}

/**
 * May this store send a text message right now?
 *
 * Two gates, in order. The plan gate is the product decision — every code is an
 * SMS somebody pays for, unlike an email — and its message already names the
 * plan that would allow it, which is the whole point of EntitlementError. The
 * daily cap is the money one, and it holds even on a plan that allows SMS.
 */
export async function checkSmsAllowed(db: TenantDb): Promise<{ ok: true } | Refusal> {
  try {
    // Reads `tenants` on the root connection, so it is safe inside the caller's
    // open transaction — the precedent is planFor() in lib/plans/entitlements.ts.
    await requireFeature(db.ctx.tenantId, "customerPhoneAuth");
  } catch (error) {
    if (error instanceof EntitlementError) return { ok: false, message: error.message };
    throw error;
  }

  const capacity = await peek(db, "sms_send_store", "store");
  if (!capacity.ok) {
    return { ok: false, message: capacity.message, retryAfterSeconds: capacity.retryAfterSeconds };
  }
  return { ok: true };
}

/** Drop buckets whose window closed long ago. Called from the nightly job. */
export async function purgeStaleRateLimits(db: TenantDb): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * 86_400_000);
  const gone = await db.delete(
    customerRateLimits,
    lt(customerRateLimits.windowStartedAt, cutoff),
  );
  return gone.length;
}

/** Drop spent and expired codes. They are a ledger, not a record worth keeping. */
export async function purgeExpiredVerifications(db: TenantDb): Promise<number> {
  const cutoff = new Date(Date.now() - 48 * 3_600_000);
  const gone = await db.delete(
    customerVerifications,
    lt(customerVerifications.createdAt, cutoff),
  );
  return gone.length;
}
