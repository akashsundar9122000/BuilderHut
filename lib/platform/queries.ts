import "server-only";

import { sql } from "drizzle-orm";

import { rowsOf } from "@/lib/db/client";
import { withPlatformAdmin } from "@/lib/db/tenant";

/*
 * What the platform operator sees.
 *
 * One rule runs through all of it, and blueprint sections 17 and 97 both insist
 * on it: MERCHANT GMV IS NOT PLATFORM REVENUE. What merchants sell is their
 * money passing through; what BuilderHut earns is fees and subscriptions. They
 * are different ledgers, they are reported separately, and the figures are
 * never added together. Conflating them would flatter the platform's numbers by
 * a factor of a hundred and make the accounts unreconcilable later.
 *
 * Every query here is raw SQL under withPlatformAdmin, because these are
 * aggregates across every tenant and the scoped builders — rightly — cannot
 * express that.
 */

export interface PlatformOverview {
  users: number;
  merchants: number;
  stores: number;
  publishedStores: number;
  suspendedStores: number;
  products: number;
  orders: number;
  /** What merchants sold. Their money, not ours. */
  gmvMinor: number;
  refundedMinor: number;
  /** What BuilderHut earned. Zero until fees or subscriptions exist. */
  platformRevenueMinor: number;
  visitors: number;
  pageViews: number;
  newStores7d: number;
  newStores30d: number;
}

export async function loadOverview(actorId: string): Promise<PlatformOverview> {
  return withPlatformAdmin(actorId, async (tx) => {
    const one = async <T>(statement: Parameters<typeof tx.execute>[0]): Promise<T> =>
      (rowsOf<T>(await tx.execute(statement))[0] ?? {}) as T;

    const counts = await one<{
      users: number; merchants: number; stores: number; suspended: number;
    }>(sql`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(DISTINCT user_id)::int FROM tenant_members) AS merchants,
        (SELECT count(*)::int FROM tenants WHERE status = 'active') AS stores,
        (SELECT count(*)::int FROM tenants WHERE status = 'suspended') AS suspended
    `);

    const stores = await one<{ published: number; new7: number; new30: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM websites WHERE published_version_id IS NOT NULL) AS published,
        (SELECT count(*)::int FROM tenants WHERE created_at > now() - interval '7 days') AS new7,
        (SELECT count(*)::int FROM tenants WHERE created_at > now() - interval '30 days') AS new30
    `);

    const catalogue = await one<{ products: number }>(sql`
      SELECT count(*)::int AS products FROM products WHERE deleted_at IS NULL
    `);

    /*
     * Only orders that represent a real sale. Unpaid, cancelled and refunded
     * orders are excluded from GMV — counting a cancelled order as merchandise
     * sold is the kind of number that makes a board deck wrong.
     */
    const commerce = await one<{ orders: number; gmv: string; refunded: string }>(sql`
      SELECT
        count(*) FILTER (WHERE status NOT IN ('pending_payment', 'cancelled', 'refunded'))::int AS orders,
        COALESCE(sum(total_minor) FILTER (WHERE status NOT IN ('pending_payment', 'cancelled', 'refunded')), 0)::text AS gmv,
        COALESCE(sum(refunded_minor), 0)::text AS refunded
      FROM orders
    `);

    /*
     * Rollups for the days that have been folded, plus today's raw events.
     *
     * Reading rollups alone showed zero visitors on a platform that plainly had
     * some — today has not been rolled up yet. The merchant dashboard already
     * combines both, and two screens disagreeing about the same number is worse
     * than either being slightly stale.
     */
    const traffic = await one<{ visitors: number; page_views: number }>(sql`
      WITH rolled AS (
        SELECT COALESCE(sum(visitors), 0)::int AS visitors,
               COALESCE(sum(page_views), 0)::int AS page_views
        FROM analytics_daily_rollups
        WHERE day > (now() - interval '30 days')::date
          AND day < now()::date
      ),
      today AS (
        SELECT count(DISTINCT visitor_id)::int AS visitors,
               count(*) FILTER (WHERE name = 'page_view')::int AS page_views
        FROM analytics_events
        WHERE created_at >= now()::date
      )
      SELECT rolled.visitors + today.visitors AS visitors,
             rolled.page_views + today.page_views AS page_views
      FROM rolled, today
    `);

    return {
      users: counts.users ?? 0,
      merchants: counts.merchants ?? 0,
      stores: counts.stores ?? 0,
      suspendedStores: counts.suspended ?? 0,
      publishedStores: stores.published ?? 0,
      newStores7d: stores.new7 ?? 0,
      newStores30d: stores.new30 ?? 0,
      products: catalogue.products ?? 0,
      orders: commerce.orders ?? 0,
      gmvMinor: Number(commerce.gmv ?? 0),
      refundedMinor: Number(commerce.refunded ?? 0),
      /*
       * Zero, and honestly so. There are no platform fees and no subscriptions
       * yet, so BuilderHut has earned nothing. Showing merchant GMV here
       * instead would be the exact mistake the blueprint warns about twice.
       */
      platformRevenueMinor: 0,
      visitors: traffic.visitors ?? 0,
      pageViews: traffic.page_views ?? 0,
    };
  });
}

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  industry: string;
  status: string;
  createdAt: string;
  ownerEmail: string | null;
  templateId: string | null;
  published: boolean;
  products: number;
  orders: number;
  gmvMinor: number;
  visitors: number;
  domains: number;
}

export async function loadStores(actorId: string, search = ""): Promise<StoreRow[]> {
  return withPlatformAdmin(actorId, async (tx) => {
    const like = `%${search.trim().toLowerCase()}%`;
    const result = await tx.execute(sql`
      SELECT
        t.id, t.name, t.slug, t.industry, t.status,
        t.created_at::text AS "createdAt",
        w.template_id AS "templateId",
        (w.published_version_id IS NOT NULL) AS published,
        u.email AS "ownerEmail",
        (SELECT count(*)::int FROM products p WHERE p.tenant_id = t.id AND p.deleted_at IS NULL) AS products,
        (SELECT count(*)::int FROM orders o WHERE o.tenant_id = t.id
           AND o.status NOT IN ('pending_payment','cancelled','refunded')) AS orders,
        (SELECT COALESCE(sum(o.total_minor), 0)::text FROM orders o WHERE o.tenant_id = t.id
           AND o.status NOT IN ('pending_payment','cancelled','refunded')) AS "gmvMinor",
        (SELECT COALESCE(sum(r.visitors), 0)::int FROM analytics_daily_rollups r
           WHERE r.tenant_id = t.id AND r.day > (now() - interval '30 days')::date) AS visitors,
        (SELECT count(*)::int FROM domains d WHERE d.tenant_id = t.id) AS domains
      FROM tenants t
      LEFT JOIN websites w ON w.tenant_id = t.id
      LEFT JOIN tenant_members m ON m.tenant_id = t.id AND m.role = 'owner'
      LEFT JOIN users u ON u.id = m.user_id
      WHERE ${search ? sql`(lower(t.name) LIKE ${like} OR lower(t.slug) LIKE ${like} OR lower(u.email) LIKE ${like})` : sql`true`}
      ORDER BY t.created_at DESC
      LIMIT 200
    `);
    return rowsOf<StoreRow & { gmvMinor: string }>(result).map((r) => ({
      ...r,
      gmvMinor: Number(r.gmvMinor ?? 0),
    }));
  });
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isPlatformAdmin: boolean;
  createdAt: string;
  stores: number;
}

export async function loadUsers(actorId: string, search = ""): Promise<UserRow[]> {
  return withPlatformAdmin(actorId, async (tx) => {
    const like = `%${search.trim().toLowerCase()}%`;
    const result = await tx.execute(sql`
      SELECT u.id, u.name, u.email, u.email_verified AS "emailVerified",
             u.is_platform_admin AS "isPlatformAdmin",
             u.created_at::text AS "createdAt",
             (SELECT count(*)::int FROM tenant_members m WHERE m.user_id = u.id) AS stores
      FROM users u
      WHERE ${search ? sql`(lower(u.email) LIKE ${like} OR lower(u.name) LIKE ${like})` : sql`true`}
      ORDER BY u.created_at DESC
      LIMIT 200
    `);
    return rowsOf<UserRow>(result);
  });
}

export interface AuditRow {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
  tenantName: string | null;
  actorEmail: string | null;
  metadata: unknown;
}

export async function loadAuditLog(actorId: string, limit = 100): Promise<AuditRow[]> {
  return withPlatformAdmin(actorId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT a.id, a.action, a.entity_type AS "entityType",
             a.created_at::text AS "createdAt", a.metadata,
             t.name AS "tenantName", u.email AS "actorEmail"
      FROM audit_logs a
      LEFT JOIN tenants t ON t.id = a.tenant_id
      LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `);
    return rowsOf<AuditRow>(result);
  });
}

export interface TemplateUsage {
  templateId: string;
  installs: number;
  published: number;
}

export async function loadTemplateUsage(actorId: string): Promise<TemplateUsage[]> {
  return withPlatformAdmin(actorId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT template_id AS "templateId",
             count(*)::int AS installs,
             count(*) FILTER (WHERE published_version_id IS NOT NULL)::int AS published
      FROM websites
      GROUP BY template_id
      ORDER BY installs DESC
    `);
    return rowsOf<TemplateUsage>(result);
  });
}

export interface DailyPlatformPoint {
  day: string;
  stores: number;
  orders: number;
  gmvMinor: number;
  visitors: number;
}

export async function loadPlatformTrend(actorId: string, days = 30): Promise<DailyPlatformPoint[]> {
  return withPlatformAdmin(actorId, async (tx) => {
    const result = await tx.execute(sql`
      WITH span AS (
        SELECT generate_series((now() - (${days} || ' days')::interval)::date, now()::date, '1 day')::date AS day
      )
      SELECT
        span.day::text AS day,
        (SELECT count(*)::int FROM tenants t WHERE t.created_at::date = span.day) AS stores,
        (SELECT count(*)::int FROM orders o WHERE o.created_at::date = span.day
           AND o.status NOT IN ('pending_payment','cancelled','refunded')) AS orders,
        (SELECT COALESCE(sum(o.total_minor), 0)::text FROM orders o WHERE o.created_at::date = span.day
           AND o.status NOT IN ('pending_payment','cancelled','refunded')) AS "gmvMinor",
        (SELECT COALESCE(sum(r.visitors), 0)::int FROM analytics_daily_rollups r WHERE r.day = span.day) AS visitors
      FROM span ORDER BY span.day
    `);
    return rowsOf<DailyPlatformPoint & { gmvMinor: string }>(result).map((r) => ({
      ...r,
      gmvMinor: Number(r.gmvMinor ?? 0),
    }));
  });
}

/* ── Traffic ─────────────────────────────────────────────────────────────── */

export interface TrafficPoint {
  day: string;
  visitors: number;
  pageViews: number;
  addToCarts: number;
  orders: number;
}

export interface TrafficStore {
  slug: string;
  name: string;
  visitors: number;
  pageViews: number;
  orders: number;
  /** Orders per visitor, as a percentage. Null when nobody visited. */
  conversion: number | null;
}

export interface PlatformTraffic {
  days: TrafficPoint[];
  topStores: TrafficStore[];
  devices: { device: string; count: number }[];
  referrers: { host: string; count: number }[];
  totals: { visitors: number; pageViews: number; orders: number };
  /**
   * How fresh the rollups are, so a zero can be read correctly.
   *
   * Every figure on this screen comes from analytics_daily_rollups, which the
   * nightly cron fills. If that cron has not run, the screen reads "0 visitors"
   * while the raw events table is full — which looks like nobody came, and is
   * actually nobody having aggregated. That was exactly the state of this
   * database when the screen was first built, so the distinction is reported
   * rather than left for somebody to work out.
   */
  freshness: { lastRollupDay: string | null; unrolledEvents: number };
}

/**
 * Traffic across every store.
 *
 * Rollups for the days that have been folded, plus today's raw events —
 * the same combination loadOverview above uses, and for the same reason its
 * comment gives: today has not been rolled up yet, so reading rollups alone
 * reports zero visitors on a platform that plainly had some. The first version
 * of this function did exactly that and disagreed with the overview page by 79
 * visitors, which is worse than either number being slightly stale.
 *
 * The two breakdowns at the bottom read raw events only, because device and
 * referrer are not in the rollup at all — so they are honestly labelled as
 * covering whatever the events table still holds.
 */
export async function loadTraffic(actorId: string, days = 30): Promise<PlatformTraffic> {
  return withPlatformAdmin(actorId, async (tx) => {
    /*
     * One source for both the series and the league table, so they cannot
     * disagree: folded days from the rollup, today from raw events.
     */
    const daily = sql`
      WITH daily AS (
        SELECT tenant_id, day, visitors, page_views, add_to_carts, orders
        FROM analytics_daily_rollups
        WHERE day > (now() - (${days} || ' days')::interval)::date
          AND day < now()::date
        UNION ALL
        SELECT tenant_id,
               now()::date AS day,
               count(DISTINCT visitor_id)::int,
               count(*) FILTER (WHERE name = 'page_view')::int,
               count(*) FILTER (WHERE name = 'add_to_cart')::int,
               count(*) FILTER (WHERE name = 'order_paid')::int
        FROM analytics_events
        WHERE created_at >= now()::date
        GROUP BY tenant_id
      )`;

    const series = rowsOf<TrafficPoint>(
      await tx.execute(sql`
        ${daily},
        span AS (
          SELECT generate_series(
            (now() - (${days} || ' days')::interval)::date, now()::date, '1 day'
          )::date AS day
        )
        SELECT span.day::text AS day,
               COALESCE(sum(d.visitors), 0)::int    AS visitors,
               COALESCE(sum(d.page_views), 0)::int  AS "pageViews",
               COALESCE(sum(d.add_to_carts), 0)::int AS "addToCarts",
               COALESCE(sum(d.orders), 0)::int      AS orders
        FROM span
        LEFT JOIN daily d ON d.day = span.day
        GROUP BY span.day
        ORDER BY span.day
      `),
    );

    const topStores = rowsOf<TrafficStore>(
      await tx.execute(sql`
        ${daily}
        SELECT t.slug, t.name,
               COALESCE(sum(d.visitors), 0)::int   AS visitors,
               COALESCE(sum(d.page_views), 0)::int AS "pageViews",
               COALESCE(sum(d.orders), 0)::int     AS orders,
               CASE WHEN COALESCE(sum(d.visitors), 0) > 0
                    THEN round(100.0 * sum(d.orders) / sum(d.visitors), 1)::float8
                    ELSE NULL END AS conversion
        FROM daily d
        JOIN tenants t ON t.id = d.tenant_id
        GROUP BY t.slug, t.name
        HAVING COALESCE(sum(d.visitors), 0) > 0
        ORDER BY visitors DESC
        LIMIT 12
      `),
    );

    const devices = rowsOf<{ device: string; count: number }>(
      await tx.execute(sql`
        SELECT COALESCE(device, 'unknown') AS device, count(*)::int AS count
        FROM analytics_events
        WHERE name = 'page_view' AND created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY count DESC LIMIT 5
      `),
    );

    const referrers = rowsOf<{ host: string; count: number }>(
      await tx.execute(sql`
        SELECT referrer_host AS host, count(*)::int AS count
        FROM analytics_events
        WHERE name = 'page_view' AND referrer_host IS NOT NULL
          AND created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY count DESC LIMIT 8
      `),
    );

    const freshness = rowsOf<{ lastRollupDay: string | null; unrolledEvents: number }>(
      await tx.execute(sql`
        SELECT
          (SELECT max(day)::text FROM analytics_daily_rollups) AS "lastRollupDay",
          (SELECT count(*)::int FROM analytics_events
            WHERE created_at::date > COALESCE(
                    (SELECT max(day) FROM analytics_daily_rollups), '-infinity'::date
                  )
              -- Today is read live below, so it is not a gap.
              AND created_at::date < now()::date) AS "unrolledEvents"
      `),
    )[0] ?? { lastRollupDay: null, unrolledEvents: 0 };

    const totals = series.reduce(
      (acc, d) => ({
        visitors: acc.visitors + d.visitors,
        pageViews: acc.pageViews + d.pageViews,
        orders: acc.orders + d.orders,
      }),
      { visitors: 0, pageViews: 0, orders: 0 },
    );

    return { days: series, topStores, devices, referrers, totals, freshness };
  });
}

/* ── Domains ─────────────────────────────────────────────────────────────── */

export interface DomainRow {
  id: string;
  hostname: string;
  status: string;
  isPrimary: boolean;
  lastCheckDetail: string | null;
  dnsCheckedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  tenantName: string | null;
  tenantSlug: string | null;
}

/**
 * Every custom domain on the platform.
 *
 * Ordered so the ones needing attention come first — a domain sitting in
 * `pending` or `misconfigured` is a merchant waiting on something, and the
 * whole reason an operator opens this screen. `active` and `verified` sort to
 * the bottom because they need nobody.
 */
export async function loadDomains(actorId: string): Promise<DomainRow[]> {
  return withPlatformAdmin(actorId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT d.id, d.hostname, d.status, d.is_primary AS "isPrimary",
             d.last_check_detail AS "lastCheckDetail",
             d.dns_checked_at::text AS "dnsCheckedAt",
             d.verified_at::text   AS "verifiedAt",
             d.created_at::text    AS "createdAt",
             t.name AS "tenantName", t.slug AS "tenantSlug"
      FROM domains d
      LEFT JOIN tenants t ON t.id = d.tenant_id
      ORDER BY
        CASE d.status
          WHEN 'misconfigured' THEN 0
          WHEN 'pending'       THEN 1
          WHEN 'disabled'      THEN 2
          WHEN 'verified'      THEN 3
          ELSE 4
        END,
        d.created_at DESC
      LIMIT 200
    `);
    return rowsOf<DomainRow>(result);
  });
}
