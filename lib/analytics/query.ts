import "server-only";

import { desc, gte, sql } from "drizzle-orm";

import { runForTenant } from "@/lib/auth/session";
import { analyticsDailyRollups, analyticsEvents } from "@/lib/db/schema";
import { rowsOf } from "@/lib/db/client";

/*
 * Reading analytics for a dashboard.
 *
 * Reads the daily rollups for anything older than today, and raw events only
 * for today — so the chart covers ninety days without ever scanning ninety
 * days of raw rows. Blueprint section 35.1's whole point.
 */

export interface DayPoint {
  day: string;
  visitors: number;
  pageViews: number;
  productViews: number;
  addToCarts: number;
  checkoutStarts: number;
  orders: number;
  revenueMinor: number;
}

export interface AnalyticsSummary {
  days: DayPoint[];
  totals: Omit<DayPoint, "day">;
  /** The same window immediately before, for an honest comparison. */
  previous: Omit<DayPoint, "day">;
  topPages: { path: string; views: number }[];
  topReferrers: { host: string; visits: number }[];
  devices: { device: string; sessions: number }[];
}

const EMPTY = {
  visitors: 0,
  pageViews: 0,
  productViews: 0,
  addToCarts: 0,
  checkoutStarts: 0,
  orders: 0,
  revenueMinor: 0,
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sum(points: DayPoint[]): Omit<DayPoint, "day"> {
  return points.reduce(
    (acc, p) => ({
      visitors: acc.visitors + p.visitors,
      pageViews: acc.pageViews + p.pageViews,
      productViews: acc.productViews + p.productViews,
      addToCarts: acc.addToCarts + p.addToCarts,
      checkoutStarts: acc.checkoutStarts + p.checkoutStarts,
      orders: acc.orders + p.orders,
      revenueMinor: acc.revenueMinor + p.revenueMinor,
    }),
    { ...EMPTY },
  );
}

export async function loadAnalytics(windowDays = 30): Promise<AnalyticsSummary> {
  const today = new Date();
  const from = new Date(today.getTime() - (windowDays - 1) * 86_400_000);
  const prevFrom = new Date(from.getTime() - windowDays * 86_400_000);

  return runForTenant(async (db) => {
    const rollups = await db
      .select(analyticsDailyRollups)
      .where(gte(analyticsDailyRollups.day, dayKey(prevFrom)))
      .orderBy(desc(analyticsDailyRollups.day))
      .limit(400);

    const byDay = new Map<string, DayPoint>();
    for (const row of rollups) {
      byDay.set(row.day, {
        day: row.day,
        visitors: row.visitors,
        pageViews: row.pageViews,
        productViews: row.productViews,
        addToCarts: row.addToCarts,
        checkoutStarts: row.checkoutStarts,
        orders: row.orders,
        revenueMinor: Number(row.revenueMinor),
      });
    }

    /*
     * Today has not been rolled up yet, so it is counted live from raw events.
     * Without this a merchant who checks at lunchtime sees a chart that stops
     * at midnight and concludes the shop is broken.
     */
    const startOfToday = new Date(`${dayKey(today)}T00:00:00.000Z`);
    const todayEvents = await db
      .select(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, startOfToday))
      .limit(5000);

    if (todayEvents.length > 0) {
      const visitors = new Set<string>();
      // Distinct sessions per stage, matching how the rollup counts them — see
      // the note there. Two different answers for today and yesterday would be
      // worse than either.
      const reached: Record<string, Set<string>> = {
        product_view: new Set(),
        add_to_cart: new Set(),
        checkout_start: new Set(),
      };
      const point: DayPoint = { day: dayKey(today), ...EMPTY };

      for (const e of todayEvents) {
        if (e.visitorId) visitors.add(e.visitorId);
        if (e.name === "page_view") point.pageViews += 1;
        else if (e.name === "order_paid") {
          point.orders += 1;
          point.revenueMinor += Number(e.valueMinor ?? 0);
        } else if (reached[e.name]) {
          reached[e.name]!.add(e.sessionId ?? e.id);
        }
      }

      point.visitors = visitors.size;
      point.productViews = reached.product_view!.size;
      point.addToCarts = reached.add_to_cart!.size;
      point.checkoutStarts = reached.checkout_start!.size;
      byDay.set(point.day, point);
    }

    // Fill every day in the window, so the chart has no gaps where nothing
    // happened — a missing day and a zero day look very different on a line.
    const days: DayPoint[] = [];
    for (let i = 0; i < windowDays; i++) {
      const key = dayKey(new Date(from.getTime() + i * 86_400_000));
      days.push(byDay.get(key) ?? { day: key, ...EMPTY });
    }

    const previousDays: DayPoint[] = [];
    for (let i = 0; i < windowDays; i++) {
      const key = dayKey(new Date(prevFrom.getTime() + i * 86_400_000));
      previousDays.push(byDay.get(key) ?? { day: key, ...EMPTY });
    }

    const topPages = rowsOf<{ path: string; views: number }>(
      await db.unsafeRaw(
        "Grouped counts over the scoped events table; the scoped select builder returns rows rather than aggregates.",
        sql`SELECT path, COUNT(*)::int AS views
            FROM analytics_events
            WHERE name = 'page_view' AND created_at >= ${from.toISOString()} AND path IS NOT NULL
            GROUP BY path ORDER BY views DESC LIMIT 8`,
      ),
    );

    const topReferrers = rowsOf<{ host: string; visits: number }>(
      await db.unsafeRaw(
        "Grouped counts over the scoped events table; the scoped select builder returns rows rather than aggregates.",
        sql`SELECT referrer_host AS host, COUNT(*)::int AS visits
            FROM analytics_events
            WHERE created_at >= ${from.toISOString()} AND referrer_host IS NOT NULL
            GROUP BY referrer_host ORDER BY visits DESC LIMIT 8`,
      ),
    );

    const devices = rowsOf<{ device: string; sessions: number }>(
      await db.unsafeRaw(
        "Grouped counts over the scoped events table; the scoped select builder returns rows rather than aggregates.",
        sql`SELECT device, COUNT(DISTINCT session_id)::int AS sessions
            FROM analytics_events
            WHERE created_at >= ${from.toISOString()} AND device IS NOT NULL
            GROUP BY device ORDER BY sessions DESC`,
      ),
    );

    return {
      days,
      totals: sum(days),
      previous: sum(previousDays),
      topPages,
      topReferrers,
      devices,
    };
  });
}

/** Percentage change, or null when the previous window had nothing to compare to. */
export function changeVs(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}
