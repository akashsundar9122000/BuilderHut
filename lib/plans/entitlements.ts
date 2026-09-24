import "server-only";

import { and, count, eq, isNull, sql } from "drizzle-orm";

import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import { auditLogs, domains, mediaAssets, products, tenantMembers, tenants } from "@/lib/db/schema";
import type { TenantDb } from "@/lib/db/tenant";
import {
  cheapestPlanFor,
  cheapestPlanWith,
  DEFAULT_PLAN,
  isPlanId,
  PLANS,
  type FeatureKey,
  type LimitKey,
  type Plan,
  type PlanId,
} from "./catalog";

/*
 * What this shop is allowed to do, decided on the server.
 *
 * Blueprint section 47 asks for entitlements as a service, and the reason is
 * the one that matters: a limit enforced only by hiding a button is not a
 * limit. Every check here runs where the write happens, so a crafted request
 * is refused by the same rule that greys out the control.
 *
 * Refusals name the plan that would allow the thing. "You've reached the limit
 * for Starter — Standard allows 300" is a sentence a merchant can act on;
 * "upgrade to continue" is a sentence that makes them leave.
 */

export class EntitlementError extends Error {
  constructor(
    message: string,
    readonly plan: Plan | null,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

/**
 * The plan a tenant is on.
 *
 * Read on the root connection against `tenants`, which is a platform table
 * with no RLS — the same read that establishes tenant context elsewhere. It
 * cannot go through withTenant, because entitlement checks run *inside* a
 * tenant transaction and nesting one deadlocks against Neon's single
 * connection.
 */
export async function planFor(tenantId: string): Promise<Plan> {
  const rows = await getRootDb()
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const value = rows[0]?.plan;
  return PLANS[isPlanId(value) ? value : DEFAULT_PLAN];
}

export interface Usage {
  products: number;
  staff: number;
  customDomains: number;
  /** Rounded, because the limit is written in whole megabytes. */
  storageMb: number;
  /** The real figure, for display: "0 MB of 250 MB" after two uploads is true
   *  and useless, and a merchant reads it as the upload having failed. */
  storageBytes: number;
}

/**
 * What the shop is using now.
 *
 * Takes the caller's open transaction rather than opening its own, for two
 * reasons that both bite. Nesting withTenant deadlocks against Neon's single
 * connection in production while passing locally. And counting on the root
 * connection — which is what this did first — reads through RLS with no
 * tenant context set, so every meter came back zero: the plan screen reported
 * "0 of 15 products" to a shop with forty, and no ceiling could ever fire.
 * RLS does not raise on a missing context, it returns nothing, which is
 * exactly why this has to run inside the scope.
 */
export async function usageFor(db: TenantDb): Promise<Usage> {
  const [productRows, staffRows, domainRows, storageRows] = await Promise.all([
    db.raw
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.tenantId, db.ctx.tenantId), isNull(products.deletedAt))),
    db.raw
      .select({ n: count() })
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, db.ctx.tenantId)),
    db.raw.select({ n: count() }).from(domains).where(eq(domains.tenantId, db.ctx.tenantId)),
    db.raw
      .select({ bytes: sql<string>`COALESCE(SUM(${mediaAssets.sizeBytes}), 0)` })
      .from(mediaAssets)
      .where(eq(mediaAssets.tenantId, db.ctx.tenantId)),
  ]);

  const storageBytes = Number(storageRows[0]?.bytes ?? 0);
  return {
    products: productRows[0]?.n ?? 0,
    staff: staffRows[0]?.n ?? 0,
    customDomains: domainRows[0]?.n ?? 0,
    storageMb: Math.round(storageBytes / 1_000_000),
    storageBytes,
  };
}

/** Whether a feature is on for this shop. */
export async function hasFeature(tenantId: string, feature: FeatureKey): Promise<boolean> {
  return (await planFor(tenantId)).features[feature];
}

/**
 * Refuse unless the feature is on.
 *
 * Throws rather than returning false, because the call sites are writes: a
 * check whose result can be ignored is a check that will be, in the one code
 * path nobody re-reads.
 */
export async function requireFeature(tenantId: string, feature: FeatureKey): Promise<void> {
  const plan = await planFor(tenantId);
  if (plan.features[feature]) return;

  const needed = cheapestPlanWith(feature);
  throw new EntitlementError(
    needed
      ? `${FEATURE_LABELS[feature]} is part of ${needed.name}. You're on ${plan.name}.`
      : `${FEATURE_LABELS[feature]} isn't available on ${plan.name}.`,
    needed,
  );
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  removeBranding: "Removing the BuilderHut footer line",
  discountCodes: "Discount codes",
  marketingTools: "Marketing tools",
  aiAssistant: "The builder assistant",
  customerPhoneAuth: "Signing customers in with a mobile number",
  prioritySupport: "Priority support",
};

const LIMIT_LABELS: Record<LimitKey, { one: string; many: string }> = {
  products: { one: "product", many: "products" },
  staff: { one: "person", many: "people" },
  customDomains: { one: "domain", many: "domains" },
  storageMb: { one: "MB of files", many: "MB of files" },
  analyticsDays: { one: "day of history", many: "days of history" },
};

export interface LimitState {
  used: number;
  limit: number | null;
  /** True when one more would exceed the plan. */
  atLimit: boolean;
}

/**
 * Refuse a write that would take the shop past its plan.
 *
 * `adding` is how many the write creates, so a bulk import asks once for the
 * whole batch rather than being refused halfway through with half of it saved.
 */
export async function requireCapacity(
  db: TenantDb,
  limit: LimitKey,
  adding = 1,
): Promise<void> {
  const plan = await planFor(db.ctx.tenantId);
  const ceiling = plan.limits[limit];
  if (ceiling === null) return;

  const usage = await usageFor(db);
  const used = usageValue(usage, limit);
  if (used + adding <= ceiling) return;

  const needed = cheapestPlanFor(limit, used + adding);
  const noun = ceiling === 1 ? LIMIT_LABELS[limit].one : LIMIT_LABELS[limit].many;
  throw new EntitlementError(
    needed && needed.id !== plan.id
      ? `${plan.name} includes ${ceiling} ${noun}. ${needed.name} allows ${describeLimit(needed.limits[limit])}.`
      : `${plan.name} includes ${ceiling} ${noun}, and you're using ${used}.`,
    needed && needed.id !== plan.id ? needed : null,
  );
}

function usageValue(usage: Usage, limit: LimitKey): number {
  switch (limit) {
    case "products": return usage.products;
    case "staff": return usage.staff;
    case "customDomains": return usage.customDomains;
    case "storageMb": return usage.storageMb;
    // Retention is a policy applied by the rollup job, not something a write
    // can exceed, so it has no usage figure to compare against.
    case "analyticsDays": return 0;
  }
}

function describeLimit(value: number | null): string {
  return value === null ? "as many as you like" : String(value);
}

/** Every meter at once, for the plan screen. */
export async function limitStates(db: TenantDb): Promise<{
  plan: Plan;
  usage: Usage;
  meters: Record<"products" | "staff" | "customDomains" | "storageMb", LimitState>;
}> {
  const [plan, usage] = await Promise.all([planFor(db.ctx.tenantId), usageFor(db)]);

  const meter = (key: "products" | "staff" | "customDomains" | "storageMb"): LimitState => {
    const ceiling = plan.limits[key];
    const used = usageValue(usage, key);
    return { used, limit: ceiling, atLimit: ceiling !== null && used >= ceiling };
  };

  return {
    plan,
    usage,
    meters: {
      products: meter("products"),
      staff: meter("staff"),
      customDomains: meter("customDomains"),
      storageMb: meter("storageMb"),
    },
  };
}

/**
 * Change a shop's plan.
 *
 * Deliberately refuses a downgrade the shop does not fit into, rather than
 * accepting it and silently disabling things the merchant is mid-way through
 * using. Telling them "you have 40 products and Starter holds 15" is the whole
 * value of checking.
 */
export async function changePlan(
  db: TenantDb,
  to: PlanId,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const target = PLANS[to];
  const tenantId = db.ctx.tenantId;
  const usage = await usageFor(db);

  for (const key of ["products", "staff", "customDomains", "storageMb"] as const) {
    const ceiling = target.limits[key];
    const used = usageValue(usage, key);
    if (ceiling !== null && used > ceiling) {
      const noun = ceiling === 1 ? LIMIT_LABELS[key].one : LIMIT_LABELS[key].many;
      return {
        ok: false,
        // A ceiling of zero is not "includes 0 domains" — that plan does not
        // include the thing at all, which is a different sentence.
        message:
          ceiling === 0
            ? `${target.name} doesn't include ${LIMIT_LABELS[key].many}, and you're using ${used}. Remove ${used === 1 ? "it" : "them"} first, and then you can move down.`
            : `${target.name} includes ${ceiling} ${noun} and you're using ${used}. Remove some first, and then you can move down.`,
      };
    }
  }

  await getRootDb()
    .update(tenants)
    .set({ plan: to, planStartedAt: new Date(), updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  await db.raw.insert(auditLogs).values({
    id: uuidv7(),
    tenantId,
    actorId: db.ctx.actorId,
    actorRole: db.ctx.role,
    action: "plan.changed",
    entityType: "tenant",
    entityId: tenantId,
    metadata: { plan: to },
  });
  return { ok: true };
}
