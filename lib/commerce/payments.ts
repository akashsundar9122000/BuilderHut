import "server-only";

import { recordPayment } from "./orders";
import type { PaymentIntent } from "@/lib/payments/provider";

/*
 * Applying what a gateway told us, out of band.
 *
 * A webhook has no session, no cookie and no tenant context — it is a POST
 * from a server in another country. The shop and the order are carried in the
 * gateway's own metadata, set by us when the payment was created and returned
 * with every event, which is what lets this be scoped properly instead of
 * searching every tenant's payments for a matching reference.
 */

export async function recordPaymentWebhook(intent: PaymentIntent): Promise<void> {
  const tenantId = asId(intent.metadata?.tenantId);
  const orderId = asId(intent.metadata?.orderId);

  if (!tenantId || !orderId) {
    /*
     * Logged and dropped rather than retried. An event without our ids is
     * either from before this mapping existed or from a payment created
     * outside BuilderHut — in Razorpay's own dashboard, say — and neither will
     * ever succeed on a retry.
     */
    console.error("[razorpay] event with no BuilderHut ids:", intent.reference);
    return;
  }

  const result = await recordPayment(tenantId, orderId, {
    provider: "razorpay",
    reference: intent.reference,
    // A refund arriving by webhook is recorded against the payment as
    // succeeded-then-refunded by the refund path; here it only has to not be
    // mistaken for a fresh success.
    state:
      intent.state === "succeeded"
        ? "succeeded"
        : intent.state === "pending"
          ? "pending"
          : intent.state === "cancelled"
            ? "cancelled"
            : intent.state === "failed"
              ? "failed"
              : "succeeded",
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    failureReason: intent.failureReason,
    metadata: { source: "webhook", method: intent.metadata?.method },
  });

  if (!result.ok) console.error("[razorpay] could not apply event:", result.message);
}

function asId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}
