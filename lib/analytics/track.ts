import "server-only";

import { cookies, headers } from "next/headers";
import { uuidv7 } from "uuidv7";

import { withTenant } from "@/lib/db/tenant";
import { analyticsEvents } from "@/lib/db/schema";

/*
 * Recording what happens on a storefront.
 *
 * What this deliberately does NOT do matters as much as what it does. There is
 * no cross-store identity, no profile, no fingerprint, and nothing joined back
 * to a customer record. A visitor id is a random value in a first-party cookie
 * scoped to ONE shop, used only to tell one person's page views apart from
 * another's within that shop. No IP address is kept. The device class is
 * reduced to three values — enough to answer "should I care about mobile", not
 * enough to identify anyone. Blueprint section 77.
 *
 * Two structural rules, both learned the hard way:
 *
 *   The request context is read OUTSIDE the deferred work. Next refuses
 *   headers() inside an after() callback during render, and the failure is
 *   silent unless something is watching the log.
 *
 *   The cookies themselves are written by middleware.ts, never here. A Server
 *   Component cannot set a cookie, and swallowing that refusal aborted the
 *   response stream on the next layout revalidation.
 */

const VISITOR_COOKIE = "bh_v";
const SESSION_COOKIE = "bh_s";

export type EventName =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "order_placed"
  | "order_paid";

export interface TrackContext {
  visitorId: string | null;
  sessionId: string | null;
  referrerHost: string | null;
  device: "mobile" | "tablet" | "desktop";
}

function deviceClass(userAgent: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet/i.test(userAgent)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** The referring site, host only — never the full URL, which can carry a query. */
function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Read the request context. Must be called during the request, not inside an
 * after() callback — Next refuses headers() there while rendering.
 */
export async function trackContext(): Promise<TrackContext> {
  try {
    const [head, jar] = await Promise.all([headers(), cookies()]);
    return {
      visitorId: jar.get(VISITOR_COOKIE)?.value ?? null,
      sessionId: jar.get(SESSION_COOKIE)?.value ?? null,
      referrerHost: referrerHost(head.get("referer")),
      device: deviceClass(head.get("user-agent") ?? ""),
    };
  } catch {
    return { visitorId: null, sessionId: null, referrerHost: null, device: "desktop" };
  }
}

export async function track(
  tenantId: string,
  name: EventName,
  context: TrackContext,
  detail: { path?: string; productId?: string; valueMinor?: number; currency?: string } = {},
): Promise<void> {
  try {
    const url = detail.path ? new URL(detail.path, "http://local") : null;

    await withTenant({ tenantId, actorId: tenantId, role: "staff" }, (db) =>
      db.insert(analyticsEvents, {
        id: uuidv7(),
        name,
        visitorId: context.visitorId,
        sessionId: context.sessionId,
        path: url?.pathname ?? detail.path ?? null,
        productId: detail.productId ?? null,
        referrerHost: context.referrerHost,
        utmSource: url?.searchParams.get("utm_source")?.slice(0, 60) ?? null,
        utmMedium: url?.searchParams.get("utm_medium")?.slice(0, 60) ?? null,
        utmCampaign: url?.searchParams.get("utm_campaign")?.slice(0, 60) ?? null,
        device: context.device,
        valueMinor: detail.valueMinor === undefined ? null : BigInt(detail.valueMinor),
        currency: detail.currency ?? null,
      }),
    );
  } catch (error) {
    // Never let analytics take down a storefront.
    console.error(`[analytics] failed to record ${name}:`, error);
  }
}
