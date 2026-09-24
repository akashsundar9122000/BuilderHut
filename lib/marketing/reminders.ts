import "server-only";
import { appUrl } from "@/lib/app-url";

import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { getRootDb } from "@/lib/db/client";
import { orders, storeSettings, tenants, websites } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { sendEmail } from "@/lib/email/provider";
import { unpaidOrderEmail } from "@/lib/email/templates";
import { PLANS, isPlanId } from "@/lib/plans/catalog";
import { recordIncident } from "@/lib/platform/incidents";

/*
 * Reminding somebody about an order they never paid for.
 *
 * The highest-value thing a small shop can automate, and the easiest to get
 * wrong. An unpaid order is a customer who meant to buy and hit something —
 * a declined card, a bank app that would not open, a phone that rang. One
 * email with a link back to the order recovers a real share of those.
 *
 * Two emails does not recover twice as many; it makes the shop a nuisance.
 * `orders.reminded_at` is set rather than counted so a second send is
 * impossible rather than unlikely, and a retried cron run is harmless.
 *
 * Deliberately NOT abandoned baskets. A basket with no order behind it has no
 * email attached to it, and the only way to get one would be to capture what
 * somebody typed into a checkout field before they decided not to buy. That is
 * a thing plenty of shops do and it is not a thing this one is going to do.
 */

/** Long enough that a retry has plainly not happened; short enough to matter. */
const WAIT_HOURS = 4;
/** Past this, the moment has gone and an email is just a reminder of a failure. */
const GIVE_UP_HOURS = 72;

export interface ReminderSummary {
  shopsConsidered: number;
  sent: number;
  skippedNoPlan: number;
  skippedOptedOut: number;
  failed: number;
}

export async function runUnpaidOrderReminders(now = new Date()): Promise<ReminderSummary> {
  const root = getRootDb();
  const summary: ReminderSummary = {
    shopsConsidered: 0,
    sent: 0,
    skippedNoPlan: 0,
    skippedOptedOut: 0,
    failed: 0,
  };

  const shops = await root
    .select({ id: tenants.id, name: tenants.name, plan: tenants.plan, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.status, "active"));

  const oldest = new Date(now.getTime() - GIVE_UP_HOURS * 3_600_000);
  const newest = new Date(now.getTime() - WAIT_HOURS * 3_600_000);
  const base = appUrl();

  for (const shop of shops) {
    summary.shopsConsidered += 1;

    const plan = PLANS[isPlanId(shop.plan) ? shop.plan : "free"];
    if (!plan.features.marketingTools) {
      summary.skippedNoPlan += 1;
      continue;
    }

    /*
     * One tenant transaction per shop rather than one query across all of
     * them: these are tenant-scoped rows, and the whole point of the scope is
     * that no query ever spans two merchants' data. A few hundred short
     * transactions is the correct shape, and this runs once a day.
     */
    const due = await withTenant(
      { tenantId: shop.id, actorId: shop.id, role: "staff" },
      async (db) => {
        const [settings] = await db.select(storeSettings).limit(1);
        if (settings && !settings.remindUnpaidOrders) return null;

        return db
          .select(orders)
          .where(
            and(
              eq(orders.status, "pending_payment"),
              isNull(orders.remindedAt),
              gte(orders.createdAt, oldest),
              lte(orders.createdAt, newest),
            ),
          )
          .limit(200);
      },
    );

    if (due === null) {
      summary.skippedOptedOut += 1;
      continue;
    }

    for (const order of due) {
      /*
       * A phone-only store may take an order with no email address on it. There
       * is nothing to send to, so it is not a failure and not a skip worth
       * counting — an SMS reminder is a different feature.
       */
      if (!order.email) continue;

      /*
       * Marked before sending, not after.
       *
       * If the send throws after the mark, one customer misses one reminder.
       * If it threw after sending but before the mark, the next run would send
       * again — and being emailed twice about the same thing is the failure
       * this whole design is arranged to avoid.
       */
      const claimed = await withTenant(
        { tenantId: shop.id, actorId: shop.id, role: "staff" },
        (db) =>
          db.update(
            orders,
            { remindedAt: new Date() },
            // Non-null by construction: `and` only returns undefined when it is
            // given nothing, and both predicates are here.
            and(eq(orders.id, order.id), isNull(orders.remindedAt))!,
          ),
      );
      // Another run got there first. Not an error, and not worth a second try.
      if (claimed.length === 0) continue;

      try {
        await sendEmail(
          unpaidOrderEmail(order.email, {
            shopName: shop.name,
            orderNumber: order.number,
            totalMinor: Number(order.totalMinor),
            currency: order.currency,
            url: `${base}/s/${shop.slug}/order/${order.id}`,
          }),
        );
        summary.sent += 1;
      } catch (error) {
        summary.failed += 1;
        console.error(`[reminders] ${shop.slug} order ${order.number}:`, error);
        // A warning, not an error: one customer missed one nudge. The order is
        // already marked reminded, so it will not be retried either way.
        await recordIncident({
          kind: "reminder.send_failed",
          severity: "warning",
          tenantId: shop.id,
          summary: `Unpaid-order reminder failed for ${shop.slug} order #${order.number}`,
          detail: { error },
        });
      }
    }
  }

  return summary;
}

export interface RecoveryStats {
  /** Unpaid orders old enough to be worth a nudge and not yet nudged. */
  waiting: number;
  reminded: number;
  /** Reminded, and subsequently paid. The only number that justifies the rest. */
  recovered: number;
  recoveredMinor: number;
}

/**
 * What the merchant sees on the marketing screen.
 *
 * Inside the tenant scope, not on the root connection with a tenant filter.
 * `orders` is RLS-protected and the app role is NOBYPASSRLS, so the second
 * shape looks correct and counts nothing — the same mistake that made every
 * plan meter read zero.
 */
export async function recoveryStats(tenantId: string): Promise<RecoveryStats> {
  const [row] = await withTenant({ tenantId, actorId: tenantId, role: "staff" }, (db) =>
    db.raw
      .select({
        waiting: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'pending_payment' AND ${orders.remindedAt} IS NULL)`,
        reminded: sql<number>`COUNT(*) FILTER (WHERE ${orders.remindedAt} IS NOT NULL)`,
        recovered: sql<number>`COUNT(*) FILTER (WHERE ${orders.remindedAt} IS NOT NULL AND ${orders.paidAt} IS NOT NULL)`,
        recoveredMinor: sql<string>`COALESCE(SUM(${orders.totalMinor}) FILTER (WHERE ${orders.remindedAt} IS NOT NULL AND ${orders.paidAt} IS NOT NULL), 0)`,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId)),
  );

  return {
    waiting: Number(row?.waiting ?? 0),
    reminded: Number(row?.reminded ?? 0),
    recovered: Number(row?.recovered ?? 0),
    recoveredMinor: Number(row?.recoveredMinor ?? 0),
  };
}

/** Whether this shop has a published storefront to send anyone back to. */
export async function hasPublishedSite(tenantId: string): Promise<boolean> {
  const rows = await withTenant({ tenantId, actorId: tenantId, role: "staff" }, (db) =>
    db
      .select(websites)
      .where(sql`${websites.publishedVersionId} IS NOT NULL`)
      .limit(1),
  );
  return rows.length > 0;
}
