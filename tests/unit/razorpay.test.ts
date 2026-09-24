import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentError } from "@/lib/payments/provider";
import {
  mapPaymentStatus,
  razorpayProvider,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  type RazorpayConfig,
} from "@/lib/payments/razorpay";

/*
 * What can be tested without an account, which is nearly all of the part that
 * matters: the signature checks that stand between a real order and somebody
 * inventing a success response, the status mapping the order machine depends
 * on, and the shape of what we send.
 *
 * `fetch` is stubbed. The alternative is an account, a network and a suite
 * that fails when Razorpay has an outage, and none of that would check
 * anything this does not.
 */

const config: RazorpayConfig = {
  keyId: "rzp_test_key",
  keySecret: "key-secret",
  webhookSecret: "webhook-secret",
};

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

describe("signatures", () => {
  it("accepts a checkout signature Razorpay would have produced", () => {
    const signature = sign(config.keySecret, "order_ABC|pay_XYZ");
    expect(verifyCheckoutSignature(config, "order_ABC", "pay_XYZ", signature)).toBe(true);
  });

  it("refuses one signed with the wrong secret", () => {
    const signature = sign("not-the-secret", "order_ABC|pay_XYZ");
    expect(verifyCheckoutSignature(config, "order_ABC", "pay_XYZ", signature)).toBe(false);
  });

  it("refuses a signature for a different payment", () => {
    // The attack this stops: paying 1 rupee on your own order and presenting
    // that signature against somebody else's.
    const signature = sign(config.keySecret, "order_ABC|pay_OTHER");
    expect(verifyCheckoutSignature(config, "order_ABC", "pay_XYZ", signature)).toBe(false);
  });

  it("refuses an empty or truncated signature without throwing", () => {
    for (const bad of ["", "abc", "0".repeat(63)]) {
      expect(verifyCheckoutSignature(config, "order_ABC", "pay_XYZ", bad)).toBe(false);
    }
  });

  it("verifies a webhook against the webhook secret, not the key secret", () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(config, body, sign(config.webhookSecret, body))).toBe(true);
    // The two secrets are different in Razorpay's dashboard, and using one for
    // the other is the classic misconfiguration.
    expect(verifyWebhookSignature(config, body, sign(config.keySecret, body))).toBe(false);
  });

  it("refuses a body that has been altered after signing", () => {
    const body = '{"event":"payment.captured","amount":100}';
    const signature = sign(config.webhookSecret, body);
    const tampered = '{"event":"payment.captured","amount":100000}';
    expect(verifyWebhookSignature(config, tampered, signature)).toBe(false);
  });
});

describe("status mapping", () => {
  it("treats authorized as pending, not paid", () => {
    // Money held is not money taken. Marking this paid would ship goods
    // against funds that can still evaporate.
    expect(mapPaymentStatus("authorized")).toBe("pending");
    expect(mapPaymentStatus("captured")).toBe("succeeded");
  });

  it("never reads an unknown status as success", () => {
    for (const status of ["", "something_new", "disputed"]) {
      expect(mapPaymentStatus(status)).toBe("pending");
    }
  });
});

describe("the adapter", () => {
  const calls: { url: string; init: RequestInit }[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = JSON.parse(String(init.body ?? "{}"));
      if (url.endsWith("/orders")) {
        return new Response(
          JSON.stringify({
            id: "order_ABC",
            amount: body.amount,
            currency: body.currency,
            status: "created",
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          id: "pay_XYZ",
          amount: 240000,
          currency: "INR",
          status: "captured",
          amount_refunded: 0,
          method: "upi",
          notes: { orderId: "our-order", tenantId: "our-tenant" },
        }),
        { status: 200 },
      );
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  const provider = razorpayProvider(config);

  it("sends the amount through unchanged, because both sides count paise", async () => {
    const intent = await provider.createPaymentIntent({
      tenantId: "our-tenant",
      orderId: "our-order",
      amountMinor: 240000,
      currency: "INR",
      customerEmail: "buyer@example.com",
      idempotencyKey: "key-1",
      returnUrl: "/s/shop/order/our-order",
    });

    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent.amount).toBe(240000);
    expect(intent.amountMinor).toBe(240000);
  });

  it("carries our ids in the notes, and not the customer's email", async () => {
    await provider.createPaymentIntent({
      tenantId: "our-tenant",
      orderId: "our-order",
      amountMinor: 1000,
      currency: "INR",
      customerEmail: "buyer@example.com",
      idempotencyKey: "key-2",
      returnUrl: "/back",
    });

    const sent = JSON.parse(String(calls[0]!.init.body));
    expect(sent.notes).toEqual({ orderId: "our-order", tenantId: "our-tenant" });
    expect(JSON.stringify(sent)).not.toContain("buyer@example.com");
  });

  it("sends an idempotency key, so a retried checkout is one payment", async () => {
    await provider.createPaymentIntent({
      tenantId: "t",
      orderId: "o",
      amountMinor: 1000,
      currency: "INR",
      customerEmail: "a@b.c",
      idempotencyKey: "the-key",
      returnUrl: "/back",
    });
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["x-razorpay-idempotency-key"]).toBe("the-key");
  });

  it("refuses a currency whose minor units it would get wrong", async () => {
    await expect(
      provider.createPaymentIntent({
        tenantId: "t",
        orderId: "o",
        amountMinor: 500,
        currency: "JPY",
        customerEmail: "a@b.c",
        idempotencyKey: "k",
        returnUrl: "/back",
      }),
    ).rejects.toThrow(PaymentError);
    // Nothing must have been sent.
    expect(calls).toHaveLength(0);
  });

  it("returns our ids from a verified webhook so the write can be scoped", async () => {
    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_XYZ",
            amount: 240000,
            currency: "INR",
            status: "captured",
            notes: { orderId: "our-order", tenantId: "our-tenant" },
          },
        },
      },
    });

    const intent = await provider.verifyWebhook(body, sign(config.webhookSecret, body));
    expect(intent?.state).toBe("succeeded");
    expect(intent?.metadata?.orderId).toBe("our-order");
    expect(intent?.metadata?.tenantId).toBe("our-tenant");
  });

  it("returns null for a webhook that is not signed by Razorpay", async () => {
    const body = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_X"}}}}';
    expect(await provider.verifyWebhook(body, sign("wrong", body))).toBeNull();
  });

  it("reads a fully refunded payment as refunded, not as paid", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          id: "pay_XYZ",
          amount: 1000,
          currency: "INR",
          status: "captured",
          amount_refunded: 1000,
        }),
        { status: 200 },
      ),
    );
    const intent = await provider.getPaymentStatus("pay_XYZ");
    expect(intent.state).toBe("refunded");
  });

  it("reads a partial refund as a partial refund", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(
        JSON.stringify({
          id: "pay_XYZ",
          amount: 1000,
          currency: "INR",
          status: "captured",
          amount_refunded: 400,
        }),
        { status: 200 },
      ),
    );
    expect((await provider.getPaymentStatus("pay_XYZ")).state).toBe("partially_refunded");
  });

  it("refuses to cancel a payment that has already been taken", async () => {
    await expect(provider.cancelPayment("pay_XYZ")).rejects.toThrow(/refund/i);
  });

  it("is honest that it is not a simulation", () => {
    expect(provider.isSimulated).toBe(false);
  });
});
