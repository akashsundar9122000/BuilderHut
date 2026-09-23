import { NextResponse, type NextRequest } from "next/server";

/*
 * Two jobs, both of which have to happen before a page renders.
 *
 * 1. Visitor and session cookies for storefront analytics.
 *
 *    These cannot be set from inside a Server Component: Next forbids writing
 *    cookies once rendering has begun, and swallowing that error is worse than
 *    useless — a layout revalidation re-renders the page, the write is refused
 *    again, and the response stream aborts. Middleware runs before any of that
 *    and can always write.
 *
 *    A visitor id is a random value in a FIRST-PARTY cookie, used only to tell
 *    one person's page views apart from another's within one shop. There is no
 *    cross-store identity here, no profile, and nothing joined to a customer
 *    record. Blueprint section 77: do not collect what is not needed.
 *
 * 2. It is where custom-domain routing will land in Phase 4. Today every
 *    storefront is reached at /s/<slug>; when a merchant connects a domain, the
 *    hostname is resolved here and rewritten to the same route.
 */

const VISITOR_COOKIE = "bh_v";
const SESSION_COOKIE = "bh_s";
const VISITOR_DAYS = 180;
const SESSION_MINUTES = 30;

function randomId(): string {
  // Web Crypto: middleware runs on the edge runtime, where node:crypto is absent.
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "").slice(0, 16);
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Only storefronts are measured. The merchant's own dashboard is not traffic.
  if (!request.nextUrl.pathname.startsWith("/s/")) return response;

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

  // Re-set on every request so the window slides: a session is thirty minutes
  // of inactivity, not thirty minutes from first arrival.
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

export const config = {
  matcher: [
    /*
     * Storefront pages only. Excluding static assets and the media route keeps
     * middleware off the hot path for every image a shop serves.
     */
    "/s/:path*",
  ],
};
