import { createHmac, timingSafeEqual } from "node:crypto";

import {
  PaymentError,
  type CreateIntentInput,
  type PaymentIntent,
  type PaymentProvider,
  type PaymentState,
  type RefundInput,
} from "./provider";

/*
 * Razorpay, behind the same six methods the simulated gateway implements.
 *
 * India first, so Razorpay first. The adapter exists to keep the order state
 * machine ignorant of Razorpay's vocabulary: it says "captured" and
 * "authorized" where we say "succeeded" and "pending", and every branch that
 * ever looked at a payment would have to learn both if this mapping lived
 * anywhere else.
 *
 * No SDK. This is four REST calls and an HMAC; a dependency here would be a
 * megabyte of code and a supply-chain surface for something the platform's own
 * `fetch` already does.
 *
 * Amounts need no conversion: Razorpay counts in paise and so do we (§103).
 * That is a happy accident for INR and would not hold for a zero-decimal
 * currency, so `assertMinorUnits` refuses the combinations it would break on
 * rather than quietly billing someone a hundred times too much.
 */

const API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 20_000;

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  /** Separate from the key secret, and set in Razorpay's webhook settings. */
  webhookSecret: string;
}

export function razorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!keyId || !keySecret || !webhookSecret) return null;
  return { keyId, keySecret, webhookSecret };
}

/**
 * Razorpay's statuses, in ours.
 *
 * `authorized` is money held but not taken, which is our "pending" — treating
 * it as success would mark an order paid for funds that can still evaporate.
 */
export function mapPaymentStatus(status: string): PaymentState {
  switch (status) {
    case "captured":
      return "succeeded";
    case "authorized":
    case "created":
    case "attempted":
      return "pending";
    case "refunded":
      return "refunded";
    case "partially_refunded":
      return "partially_refunded";
    case "failed":
      return "failed";
    default:
      // An unknown status must not read as success. Pending is the safe
      // reading: it leaves the order unpaid and the merchant able to look.
      return "pending";
  }
}

/** Razorpay counts in the currency's minor unit, as we do — but not always. */
function assertMinorUnits(currency: string): void {
  const code = currency.toUpperCase();
  // Razorpay's zero-decimal currencies are still sent as `amount * 100`, so a
  // JPY amount would be inflated a hundredfold by passing our minor units
  // straight through. Refuse rather than get it wrong.
  if (code !== "INR") {
    throw new PaymentError(
      `Razorpay is configured for INR here. ${code} would need its own amount conversion.`,
      "provider_error",
    );
  }
}

function authHeader(config: RazorpayConfig): string {
  return `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64")}`;
}

interface RazorpayError {
  error?: { description?: string; reason?: string; code?: string };
}

async function call<T>(
  config: RazorpayConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string },
): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API}${path}`, {
      method: init.method,
      signal: abort.signal,
      headers: {
        authorization: authHeader(config),
        "content-type": "application/json",
        // Razorpay replays the original response for a repeated key, which is
        // what makes a retried checkout create one payment rather than two.
        ...(init.idempotencyKey ? { "x-razorpay-idempotency-key": init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as T & RazorpayError) : ({} as T & RazorpayError);

    if (!response.ok) {
      const description = parsed.error?.description ?? `Razorpay answered ${response.status}.`;
      throw new PaymentError(
        description,
        // 4xx that is not a rate limit is our mistake or a declined instrument;
        // anything else is theirs and worth retrying.
        response.status === 400 ? "declined" : "provider_error",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof PaymentError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PaymentError("Razorpay did not answer in time.", "timeout");
    }
    throw new PaymentError("Razorpay could not be reached.", "provider_error");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify the signature Razorpay's checkout hands back to the browser.
 *
 * The browser is the one telling us a payment succeeded, so this is the only
 * thing standing between a real order and somebody typing a success response
 * into their console. HMAC of "<order_id>|<payment_id>" with the key secret,
 * compared in constant time.
 */
export function verifyCheckoutSignature(
  config: RazorpayConfig,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", config.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

/** Verify a webhook body against the webhook secret. */
export function verifyWebhookSignature(
  config: RazorpayConfig,
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", config.webhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}

/**
 * Constant-time comparison that does not leak length either.
 *
 * `timingSafeEqual` throws on differing lengths, and catching that would
 * itself be a fast path for a wrong-length signature. Hashing both sides first
 * makes every comparison the same shape.
 */
function safeEqual(a: string, b: string): boolean {
  const left = createHmac("sha256", "compare").update(a).digest();
  const right = createHmac("sha256", "compare").update(b).digest();
  return timingSafeEqual(left, right);
}

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  order_id?: string;
  method?: string;
  error_description?: string;
  amount_refunded?: number;
  /** Set by us when the order was created; echoed back on every event. */
  notes?: { orderId?: string; tenantId?: string };
}

function intentFromPayment(payment: RazorpayPayment): PaymentIntent {
  const state = mapPaymentStatus(payment.status);
  const refunded = payment.amount_refunded ?? 0;
  return {
    reference: payment.id,
    state:
      state === "succeeded" && refunded > 0
        ? refunded >= payment.amount
          ? "refunded"
          : "partially_refunded"
        : state,
    amountMinor: payment.amount,
    currency: payment.currency,
    failureReason: payment.error_description,
    // Deliberately narrow. A provider response can carry a cardholder name and
    // the last four digits, and none of that belongs in our database. Our own
    // ids travel back so a webhook knows which order it is about.
    metadata: {
      method: payment.method,
      amountRefunded: refunded,
      orderId: payment.notes?.orderId,
      tenantId: payment.notes?.tenantId,
    },
  };
}

export function razorpayProvider(config: RazorpayConfig): PaymentProvider {
  return {
    id: "razorpay",
    displayName: "Razorpay",
    isSimulated: false,

    async createPaymentIntent(input: CreateIntentInput): Promise<PaymentIntent> {
      assertMinorUnits(input.currency);

      const order = await call<RazorpayOrder>(config, "/orders", {
        method: "POST",
        idempotencyKey: input.idempotencyKey,
        body: {
          amount: input.amountMinor,
          currency: input.currency.toUpperCase(),
          // Razorpay caps the receipt at 40 characters, and a uuidv7 is 36.
          receipt: input.orderId.slice(0, 40),
          /*
           * Our own ids, so the webhook can find the order. Not the customer's
           * email: notes are free-form metadata a gateway keeps indefinitely,
           * and there is no reason for an address to live there when Razorpay
           * already has whatever the customer typed on its own page.
           */
          notes: { orderId: input.orderId, tenantId: input.tenantId },
        },
      });

      return {
        reference: order.id,
        state: "pending",
        amountMinor: order.amount,
        currency: order.currency,
        metadata: { razorpayOrderId: order.id, keyId: config.keyId },
      };
    },

    async getPaymentStatus(reference: string): Promise<PaymentIntent> {
      /*
       * A reference is a payment id once the customer has paid and an order id
       * before that. Checking the prefix avoids a wasted round trip and, more
       * importantly, avoids reporting "not found" for an order that simply has
       * no payment against it yet.
       */
      if (reference.startsWith("order_")) {
        const result = await call<{ items: RazorpayPayment[] }>(
          config,
          `/orders/${reference}/payments`,
          { method: "GET" },
        );
        const payment = result.items?.find((p) => p.status === "captured") ?? result.items?.[0];
        if (!payment) {
          return { reference, state: "pending", amountMinor: 0, currency: "INR" };
        }
        return intentFromPayment(payment);
      }

      return intentFromPayment(
        await call<RazorpayPayment>(config, `/payments/${reference}`, { method: "GET" }),
      );
    },

    async capturePayment(reference: string): Promise<PaymentIntent> {
      const current = await call<RazorpayPayment>(config, `/payments/${reference}`, {
        method: "GET",
      });
      // Capturing an already-captured payment is an error at Razorpay, and
      // "already done" is not a failure worth surfacing to a merchant.
      if (current.status === "captured") return intentFromPayment(current);

      return intentFromPayment(
        await call<RazorpayPayment>(config, `/payments/${reference}/capture`, {
          method: "POST",
          body: { amount: current.amount, currency: current.currency },
        }),
      );
    },

    async refundPayment(input: RefundInput): Promise<PaymentIntent> {
      assertMinorUnits(input.currency);

      await call<{ id: string; amount: number }>(config, `/payments/${input.reference}/refund`, {
        method: "POST",
        // Keyed on the amount as well as the payment, so a retried refund does
        // not become a second one.
        idempotencyKey: `refund:${input.reference}:${input.amountMinor}`,
        body: {
          amount: input.amountMinor,
          notes: input.reason ? { reason: input.reason.slice(0, 200) } : undefined,
        },
      });

      // Re-read rather than trusting the refund response: whether this leaves
      // the payment partially or fully refunded is the payment's business.
      return intentFromPayment(
        await call<RazorpayPayment>(config, `/payments/${input.reference}`, { method: "GET" }),
      );
    },

    async cancelPayment(reference: string): Promise<PaymentIntent> {
      /*
       * Razorpay has no cancel. An order the customer abandoned simply stays
       * unpaid and expires on their side, and an authorised payment is voided
       * by not capturing it. Reporting a cancellation we did not perform would
       * be a lie the order state machine would then act on.
       */
      if (reference.startsWith("order_")) {
        return { reference, state: "cancelled", amountMinor: 0, currency: "INR" };
      }
      const payment = await call<RazorpayPayment>(config, `/payments/${reference}`, {
        method: "GET",
      });
      if (payment.status === "captured") {
        throw new PaymentError(
          "That payment has already been taken. Refund it instead of cancelling it.",
          "provider_error",
        );
      }
      return { ...intentFromPayment(payment), state: "cancelled" };
    },

    async verifyWebhook(rawBody: string, signature: string): Promise<PaymentIntent | null> {
      if (!verifyWebhookSignature(config, rawBody, signature)) return null;

      let event: { event?: string; payload?: { payment?: { entity?: RazorpayPayment } } };
      try {
        event = JSON.parse(rawBody);
      } catch {
        return null;
      }

      const payment = event.payload?.payment?.entity;
      if (!payment?.id) return null;
      return intentFromPayment(payment);
    },
  };
}
