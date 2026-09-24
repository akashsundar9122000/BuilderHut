/*
 * The payment boundary.
 *
 * Blueprint section 11 and section 96: order logic depends on these normalised
 * states and never on a gateway's vocabulary. Razorpay says "captured",
 * Stripe says "succeeded", and the order state machine should have to learn
 * neither — otherwise adding a second gateway means auditing every branch that
 * ever looked at a payment.
 *
 * Nothing in this interface takes card details. Real gateways collect those on
 * their own hosted page or in their own iframe precisely so that a platform
 * like this never touches them, and the dummy provider keeps the same shape so
 * the swap changes no call sites.
 */

export type PaymentState =
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded";

export interface PaymentIntent {
  /** The provider's own reference. Stored, shown to the merchant, never parsed. */
  reference: string;
  state: PaymentState;
  amountMinor: number;
  currency: string;
  /** Where to send the customer, when the provider hosts the payment page. */
  redirectUrl?: string;
  failureReason?: string;
  /** Redacted provider response, for the merchant's order screen. */
  metadata?: Record<string, unknown>;
}

export interface CreateIntentInput {
  /**
   * Which shop the money is for.
   *
   * A hosted gateway tells us about a payment out of band, long after the
   * request that created it — and the webhook has no session, no cookie and
   * no tenant context. Handing the shop's id to the provider means it comes
   * back with the event, so the write can be scoped without a cross-tenant
   * lookup that RLS would have to be worked around to perform.
   */
  tenantId: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  customerEmail: string;
  /** Deduplicates a retried request at the provider as well as in our database. */
  idempotencyKey: string;
  returnUrl: string;
}

export interface RefundInput {
  reference: string;
  amountMinor: number;
  currency: string;
  reason?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly displayName: string;
  /** True when no real money moves. Surfaced in the UI — never hidden. */
  readonly isSimulated: boolean;

  createPaymentIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  getPaymentStatus(reference: string): Promise<PaymentIntent>;
  capturePayment(reference: string): Promise<PaymentIntent>;
  refundPayment(input: RefundInput): Promise<PaymentIntent>;
  cancelPayment(reference: string): Promise<PaymentIntent>;
  /** Returns the verified event, or null when the signature does not check out. */
  verifyWebhook(rawBody: string, signature: string): Promise<PaymentIntent | null>;
}

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: "declined" | "cancelled" | "timeout" | "provider_error" | "not_found",
  ) {
    super(message);
    this.name = "PaymentError";
  }
}
