import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { type DummyOutcome } from "./test-cards";
import {
  PaymentError,
  type CreateIntentInput,
  type PaymentIntent,
  type PaymentProvider,
  type PaymentState,
  type RefundInput,
} from "./provider";

/*
 * A simulated gateway.
 *
 * It behaves like a real one — intents, references, states, refunds, signed
 * webhooks — so that swapping in Razorpay or Stripe later changes this file and
 * nothing else. What it does NOT do is move money, and it says so everywhere it
 * is surfaced. Blueprint section 101 rule 16: do not claim an integration works
 * when it is mocked.
 *
 * The outcome is chosen by the test card number, which is how real gateways'
 * sandboxes work, so a merchant learns the same habit they will need later.
 */

function secret(): string {
  // Only ever used to sign this provider's own simulated webhooks.
  return process.env.BETTER_AUTH_SECRET ?? "builderhut-dummy-payment-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/*
 * In-process state for intents that have not reached a terminal outcome.
 *
 * Deliberately not a database table: a simulated gateway's internal state is
 * not the platform's data, and giving it a table would invite something to
 * start depending on it. The payments table records what happened, which is the
 * part that must survive a restart.
 */
const intents = new Map<string, PaymentIntent>();

export const dummyPaymentProvider: PaymentProvider = {
  id: "dummy",
  displayName: "Test payments",
  isSimulated: true,

  async createPaymentIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    if (input.amountMinor <= 0) {
      throw new PaymentError("A payment must be for more than nothing.", "provider_error");
    }
    // Shaped like a gateway reference so nothing learns to parse ours.
    const reference = `dmy_${randomBytes(12).toString("hex")}`;
    const intent: PaymentIntent = {
      reference,
      state: "pending",
      amountMinor: input.amountMinor,
      currency: input.currency,
      redirectUrl: `${input.returnUrl}?payment=${reference}`,
      metadata: { simulated: true, orderId: input.orderId },
    };
    intents.set(reference, intent);
    return intent;
  },

  async getPaymentStatus(reference: string): Promise<PaymentIntent> {
    const intent = intents.get(reference);
    if (!intent) throw new PaymentError("No such payment.", "not_found");
    return intent;
  },

  async capturePayment(reference: string): Promise<PaymentIntent> {
    const intent = intents.get(reference);
    if (!intent) throw new PaymentError("No such payment.", "not_found");
    const next = { ...intent, state: "succeeded" as PaymentState };
    intents.set(reference, next);
    return next;
  },

  async refundPayment(input: RefundInput): Promise<PaymentIntent> {
    const intent = intents.get(input.reference);
    if (!intent) throw new PaymentError("No such payment.", "not_found");
    if (intent.state !== "succeeded" && intent.state !== "partially_refunded") {
      throw new PaymentError("Only a completed payment can be refunded.", "provider_error");
    }
    if (input.amountMinor > intent.amountMinor) {
      throw new PaymentError("A refund cannot exceed the payment.", "provider_error");
    }
    const full = input.amountMinor === intent.amountMinor;
    const next: PaymentIntent = {
      ...intent,
      state: full ? "refunded" : "partially_refunded",
      metadata: { ...intent.metadata, refundedMinor: input.amountMinor, reason: input.reason },
    };
    intents.set(input.reference, next);
    return next;
  },

  async cancelPayment(reference: string): Promise<PaymentIntent> {
    const intent = intents.get(reference);
    if (!intent) throw new PaymentError("No such payment.", "not_found");
    if (intent.state === "succeeded") {
      throw new PaymentError("A completed payment cannot be cancelled; refund it.", "provider_error");
    }
    const next = { ...intent, state: "cancelled" as PaymentState };
    intents.set(reference, next);
    return next;
  },

  async verifyWebhook(rawBody: string, signature: string): Promise<PaymentIntent | null> {
    const expected = sign(rawBody);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    // Constant-time, and length-checked first because timingSafeEqual throws on
    // a mismatch. Comparing with === would leak the signature a byte at a time.
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      return JSON.parse(rawBody) as PaymentIntent;
    } catch {
      return null;
    }
  },
};

/** Drives a simulated intent to the outcome the test card asked for. */
export function settleSimulatedPayment(
  reference: string,
  outcome: DummyOutcome,
): PaymentIntent {
  const intent = intents.get(reference);
  if (!intent) throw new PaymentError("No such payment.", "not_found");

  const next: PaymentIntent = (() => {
    switch (outcome) {
      case "succeeded":
        return { ...intent, state: "succeeded" as PaymentState };
      case "failed":
        return {
          ...intent,
          state: "failed" as PaymentState,
          failureReason: "Your card was declined. Try another card.",
        };
      case "timeout":
        return {
          ...intent,
          state: "failed" as PaymentState,
          failureReason: "The payment timed out before it completed.",
        };
      case "pending":
        return { ...intent, state: "pending" as PaymentState };
    }
  })();

  intents.set(reference, next);
  return next;
}

export function getPaymentProvider(id = "dummy"): PaymentProvider {
  switch (id) {
    case "dummy":
      return dummyPaymentProvider;
    default:
      // A store configured for a provider that does not exist must not silently
      // fall back to taking no money.
      throw new PaymentError(`No payment provider called "${id}" is available.`, "provider_error");
  }
}

export { TEST_CARDS, outcomeForCard, type DummyOutcome } from "./test-cards";
