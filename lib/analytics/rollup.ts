import "server-only";

import { and, gte, lt, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb, rowsOf } from "@/lib/db/client";
import { withTenant } from "@/lib/db/tenant";
import { analyticsDailyRollups, analyticsEvents, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/*
 * Folding raw events into one row per store per day.
 *
 * Run nightly. Two jobs in one: produce the numbers the dashboards read, and
 * make the raw events disposable so they never grow without bound.
 *
 * The rollup for a day is recomputed rather than incremented, so running it
 * twice is harmless — which matters, because a cron that retries is a cron that
 * will eventually run twice.
 */

const RAW_RETENTION_DAYS = 45;

export interface RollupSummary {
  tenants: number;
  days: number;
  purged: number;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function rollupDay(tenantId: string, day: Date): Promise<void> {
  const start = new Date(`${dayKey(day)}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  await withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
    const events = await db
      .select(analyticsEvents)
      .where(and(gte(analyticsEvents.createdAt, start), lt(analyticsEvents.createdAt, end)));

    if (events.length === 0) return;

    const visitors = new Set<string>();
    const sessions = new Set<string>();

    /*
     * Funnel stages count DISTINCT SESSIONS that reached them, not raw events.
     *
     * A router refresh — which Next performs after every server action — re-runs
     * a page's render and fires its view event again. Counting raw events made
     * "looked at a product" exceed "visited", which reads as a broken dashboard.
     * Sessions are also the more meaningful question: a funnel asks how many
     * people got this far, not how many times a page rendered.
     *
     * Page views stay a raw count, because volume is what that metric means.
     */
    const reached: Record<string, Set<string>> = {
      product_view: new Set(),
      add_to_cart: new Set(),
      checkout_start: new Set(),
    };
    let pageViews = 0;
    let orders = 0;
    let revenue = 0n;
    let currency: string | null = null;

    for (const event of events) {
      if (event.visitorId) visitors.add(event.visitorId);
      if (event.sessionId) sessions.add(event.sessionId);

      if (event.name === "page_view") {
        pageViews += 1;
      } else if (event.name === "order_paid") {
        // Every paid order is a real order, so this one is a raw count.
        orders += 1;
        revenue += event.valueMinor ?? 0n;
        currency ??= event.currency;
      } else if (reached[event.name]) {
        // An event with no session still counts as one arrival.
        reached[event.name]!.add(event.sessionId ?? event.id);
      }
    }

    const values = {
      day: dayKey(day),
      visitors: visitors.size,
      sessions: sessions.size,
      pageViews,
      productViews: reached.product_view!.size,
      addToCarts: reached.add_to_cart!.size,
      checkoutStarts: reached.checkout_start!.size,
      orders,
      revenueMinor: revenue,
      currency,
    };

    // Recomputed, not incremented, so a second run is a no-op rather than a
    // doubling.
    const [existing] = await db
      .select(analyticsDailyRollups)
      .where(eq(analyticsDailyRollups.day, dayKey(day)))
      .limit(1);

    if (existing) {
      await db.update(analyticsDailyRollups, values, eq(analyticsDailyRollups.id, existing.id));
    } else {
      await db.insert(analyticsDailyRollups, { id: uuidv7(), ...values });
    }
  });
}

/** Roll up yesterday and today for every store, then purge stale raw events. */
export async function runRollup(): Promise<RollupSummary> {
  const db = getRootDb();
  const stores = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.status, "active"));

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  for (const store of stores) {
    // Today as well as yesterday, so a merchant checking at lunchtime sees
    // this morning rather than only up to midnight.
    await rollupDay(store.id, yesterday);
    await rollupDay(store.id, today);
  }

  const cutoff = new Date(Date.now() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const purged = await db.execute(
    sql`DELETE FROM analytics_events WHERE created_at < ${cutoff.toISOString()}`,
  );

  return {
    tenants: stores.length,
    days: stores.length * 2,
    purged: rowsOf(purged).length,
  };
}
