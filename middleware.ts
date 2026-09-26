import { neon } from "@neondatabase/serverless";
import { NextResponse, type NextRequest } from "next/server";

import { appHost } from "@/lib/app-url";

/*
 * Three jobs, all of which must happen before a page renders.
 *
 * 1. Custom-domain routing. A merchant's own domain is rewritten to the same
 *    /s/<slug> route the BuilderHut address uses, so there is exactly one
 *    storefront implementation rather than two that drift.
 *
 * 2. Visitor and session cookies for storefront analytics. These cannot be set
 *    from a Server Component — Next forbids writing cookies once rendering has
 *    begun, and swallowing that refusal aborted the response stream on the next
 *    revalidation. Middleware runs first and can always write.
 *
 *    A visitor id is a random value in a FIRST-PARTY cookie scoped to one shop.
 *    No cross-store identity, no profile, nothing joined to a customer record.
 *
 * 3. Redirecting alternate domains to the primary one, so a shop never has two
 *    addresses competing for the same search listing.
 *
 * The DNS lookup uses Neon's HTTP driver, which is the only one that runs on
 * the edge runtime, and results are cached in module memory for a minute —
 * a database round trip on every storefront request would be indefensible.
 */

const VISITOR_COOKIE = "bh_v";
const SESSION_COOKIE = "bh_s";
const VISITOR_DAYS = 180;
const SESSION_MINUTES = 30;
const HOST_CACHE_MS = 60_000;

/*
 * The resolved shop, forwarded to the render as a request header.
 *
 * A not-found page cannot read route params — Next does not give them to it —
 * so without this a customer who mistypes a product URL gets a generic
 * BuilderHut page instead of the shop's own 404 with its own navigation. The
 * header is set by middleware, so it is not something a browser can forge into
 * a render: an inbound copy is overwritten on every request below.
 */
const SLUG_HEADER = "x-bh-slug";

/** hostname -> slug (or null for "no such domain"), with an expiry. */
const hostCache = new Map<string, { slug: string | null; at: number }>();

function randomId(): string {
  // Web Crypto: node:crypto is absent on the edge runtime.
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 16);
}

/** Hosts that serve BuilderHut itself rather than a merchant's shop. */
function isPlatformHost(host: string): boolean {
  const bare = host.split(":")[0] ?? "";
  return (
    bare === appHost() ||
    bare === "localhost" ||
    bare === "127.0.0.1" ||
    bare.endsWith(".vercel.app") ||
    bare.endsWith(".builderhut.app")
  );
}

async function slugForHost(hostname: string): Promise<string | null> {
  const cached = hostCache.get(hostname);
  if (cached && Date.now() - cached.at < HOST_CACHE_MS) return cached.slug;

  let slug: string | null = null;
  try {
    const sql = neon(process.env.DATABASE_URL!);
    /*
     * Only ACTIVE domains resolve, which is what makes disconnecting one take
     * effect immediately. The domains_public_routing policy is what lets this
     * read succeed with no tenant context — see migration 0012.
     */
    const rows = (await sql`
      SELECT t.slug
      FROM domains d
      JOIN tenants t ON t.id = d.tenant_id
      WHERE d.normalized_hostname = ${hostname}
        AND d.status = 'active'
        AND t.status = 'active'
      LIMIT 1
    `) as { slug: string }[];
    slug = rows[0]?.slug ?? null;
  } catch (error) {
    // A lookup failure must not take every storefront down with it. Not
    // cached, so the next request tries again.
    console.error("[middleware] hostname lookup failed:", error);
    return null;
  }

  hostCache.set(hostname, { slug, at: Date.now() });
  return slug;
}

/** Request headers for the render, with the shop's slug attached. */
function forward(request: NextRequest, slug: string): Headers {
  const headers = new Headers(request.headers);
  headers.set(SLUG_HEADER, slug);
  return headers;
}

/** The slug in a BuilderHut-hosted storefront path, if this is one. */
function slugFromPath(path: string): string | null {
  const match = /^\/s\/([^/]+)/.exec(path);
  return match ? decodeURIComponent(match[1]!) : null;
}

function withAnalyticsCookies(request: NextRequest, response: NextResponse): NextResponse {
  const secure = request.nextUrl.protocol === "https:";

  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, randomId(), {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 60 * 24 * VISITOR_DAYS,
    });
  }

  // Re-set every request so the window slides: a session is thirty minutes of
  // inactivity, not thirty minutes from arrival.
  const session = request.cookies.get(SESSION_COOKIE)?.value ?? randomId();
  response.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * SESSION_MINUTES,
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;

  /*
   * One canonical host for the platform itself.
   *
   * A Vercel project keeps every hostname it has ever had, so an older
   * *.vercel.app alias goes on serving the current deployment forever. That
   * looks harmless and is not: Better Auth rejects any request whose origin is
   * not its baseURL, so the old address renders every page perfectly and then
   * refuses every sign-in — and the login form reports that refusal as "that
   * email and password don't match an account". Somebody with the old URL
   * bookmarked would conclude their password was wrong.
   *
   * 308 rather than 302, so the method and body survive and browsers remember.
   *
   * Storefronts on merchant domains are untouched: this runs only for hosts
   * that serve BuilderHut itself, and only in production, where there is a
   * stable production hostname to be canonical about. In preview, appHost() is
   * the deployment's own host, so this never fires.
   */
  if (process.env.VERCEL_ENV === "production") {
    const bare = (host.split(":")[0] ?? "").toLowerCase();
    const canonical = appHost();
    if (bare.endsWith(".vercel.app") && canonical && bare !== canonical) {
      const url = request.nextUrl.clone();
      url.host = canonical;
      url.port = "";
      url.protocol = "https:";
      return NextResponse.redirect(url, 308);
    }
  }

  // A merchant's own domain: resolve it and serve the same storefront route.
  if (!isPlatformHost(host)) {
    const hostname = (host.split(":")[0] ?? "").toLowerCase();
    const slug = await slugForHost(hostname);

    // An unknown or disconnected domain gets the platform's landing page
    // rather than a broken shop.
    if (!slug) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = `/s/${slug}${path === "/" ? "" : path}`;
    return withAnalyticsCookies(
      request,
      NextResponse.rewrite(url, { request: { headers: forward(request, slug) } }),
    );
  }

  // BuilderHut's own host. Only storefront paths are measured — the merchant's
  // dashboard is not traffic.
  const slug = slugFromPath(path);
  if (!slug) return NextResponse.next();
  return withAnalyticsCookies(
    request,
    NextResponse.next({ request: { headers: forward(request, slug) } }),
  );
}

export const config = {
  matcher: [
    /*
     * Everything except Next's internals, the media route and the guide's
     * screenshots. A custom domain can arrive at any path, so this cannot be
     * narrowed to /s/ — but keeping middleware off static assets and off every
     * image a shop serves matters.
     *
     * guide-shots/ is excluded for a second reason as well as cost: on a
     * merchant's custom domain the rewrite below would send each screenshot to
     * /s/<slug>/guide-shots/… and every picture in the guide would 404.
     */
    "/((?!_next/static|_next/image|media/|guide-shots/|favicon.ico).*)",
  ],
};
