import "server-only";

import { headers } from "next/headers";

import { appIsSecure } from "@/lib/app-url";

/*
 * Secure follows the transport, not the build.
 *
 * Safari refuses a Secure cookie over plain http, including on localhost — so
 * keying this off NODE_ENV meant a production build served over http had a
 * basket that silently never filled: the row was written, the cookie was
 * dropped, and the next page found no cart. It cost an afternoon to find,
 * because everything reported success.
 *
 * The proxy header is what Vercel sets, and it is what middleware already uses
 * for the analytics cookies, so the two now agree.
 *
 * This lives here rather than in lib/commerce/cart.ts because the customer
 * session cookie needs the identical rule, and a second copy of an afternoon's
 * lesson is a second copy that rots.
 */
export async function isSecureRequest(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]!.trim() === "https";
  return appIsSecure();
}
