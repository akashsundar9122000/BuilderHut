import { after } from "next/server";

import { recordPaymentWebhook } from "@/lib/commerce/payments";
import { razorpayConfig, razorpayProvider } from "@/lib/payments/razorpay";

/*
 * Razorpay tells us what happened, independently of the customer's browser.
 *
 * This is the authority, not the redirect back from checkout: a customer can
 * close the tab the instant they pay, and the browser can be lied to. The
 * webhook arrives from Razorpay, signed, and is what actually marks an order
 * paid.
 *
 * Razorpay retries a non-2xx for hours, so anything we can safely swallow is
 * answered 200 and logged. The only 4xx here is a signature that does not
 * check out, which is either a misconfiguration or somebody trying it on —
 * and retrying that forever helps nobody.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = razorpayConfig();
  if (!config) {
    // Not configured: the endpoint exists but has nothing to verify against,
    // and accepting unverified payment events would be the whole vulnerability.
    return new Response("not configured", { status: 503 });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  /*
   * The raw body, before any parsing. The signature is over the exact bytes
   * Razorpay sent, so re-serialising parsed JSON would change whitespace and
   * key order and fail every time.
   */
  const raw = await request.text();

  const intent = await razorpayProvider(config).verifyWebhook(raw, signature);
  if (!intent) return new Response("bad signature", { status: 400 });

  /*
   * Acknowledged first, applied after. Razorpay's timeout is short and our
   * write goes to a database in another region; a slow write would look like a
   * failure and be retried, and the retries would pile up behind each other.
   */
  after(() => recordPaymentWebhook(intent));
  return new Response("ok", { status: 200 });
}
