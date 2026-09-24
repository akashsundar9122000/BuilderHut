"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  addToCart,
  applyDiscountCode,
  getCart,
  readCartToken,
  setCartQuantity,
} from "@/lib/commerce/cart";
import { placeOrder } from "@/lib/commerce/orders";
import { recordPayment } from "@/lib/commerce/orders";
import { razorpayConfig, razorpayProvider, verifyCheckoutSignature } from "@/lib/payments/razorpay";
import { getPaymentProvider, settleSimulatedPayment } from "@/lib/payments/dummy";
import { outcomeForCard } from "@/lib/payments/test-cards";
import { loadPublishedSite } from "@/lib/stores/storefront";
import { track, trackContext } from "@/lib/analytics/track";
import { loadOrderForPayment } from "@/lib/commerce/orders";

/*
 * Storefront actions.
 *
 * These run for anonymous visitors, so there is no session to derive a tenant
 * from. The store slug in the URL is the authorization — it identifies exactly
 * one shop, and everything these touch belongs to that shop and no other. Each
 * action resolves the slug itself rather than trusting a tenant id from the
 * form, which is the rule blueprint section 93 states in capitals.
 */

async function resolveStore(slug: string) {
  const site = await loadPublishedSite(slug);
  if (!site) redirect("/");
  return site;
}

export async function addToCartAction(slug: string, productId: string, quantity = 1) {
  const site = await resolveStore(slug);
  const result = await addToCart(site.tenantId, site.currency, productId, quantity);

  /*
   * after(), not await: the customer should not wait on a second database
   * round trip for a number nobody is looking at yet. Awaiting it roughly
   * doubled how long "Adding…" stayed on screen.
   */
  if (result.ok) {
    const measured = await trackContext();
    after(() => track(site.tenantId, "add_to_cart", measured, { productId }));
  }

  /*
   * No revalidatePath here, deliberately.
   *
   * Revalidating the storefront layout from an action that runs ON a page
   * inside that layout makes Next re-render the page as part of the action's
   * response — and that re-render aborted the response stream, so "add to
   * basket" appeared to do nothing while the row was already in the database.
   *
   * Nothing on the current page depends on the basket's contents anyway. The
   * basket page reads fresh on navigation, and the action returns its own
   * result for the button to report.
   */
  return result.ok ? { ok: true as const } : { ok: false as const, message: result.message };
}

/*
 * Returns the recomputed basket rather than relying on path revalidation.
 *
 * The totals still come from the server — the browser never does the sums — but
 * handing them back directly makes the update immediate and removes a whole
 * class of "the number changed in the database and not on screen" bugs. The
 * layout is revalidated too, so the header's basket count follows.
 */
export async function setQuantityAction(slug: string, productId: string, quantity: number) {
  const site = await resolveStore(slug);
  await setCartQuantity(site.tenantId, site.currency, productId, quantity);
  revalidatePath(`/s/${slug}`, "layout");
  return getCart(site.tenantId, site.currency);
}

export async function applyDiscountAction(slug: string, code: string | null) {
  const site = await resolveStore(slug);
  const result = await applyDiscountCode(site.tenantId, site.currency, code);
  revalidatePath(`/s/${slug}`, "layout");
  return result;
}

const CheckoutSchema = z.object({
  email: z.string().trim().toLowerCase().email("That doesn't look like an email address."),
  name: z.string().trim().min(2, "We need a name for the parcel."),
  phone: z.string().trim().max(32).optional(),
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(16).optional(),
  country: z.string().trim().length(2).optional(),
  shippingMethodId: z.string().trim().min(1, "Choose how you'd like to receive it."),
  customerNote: z.string().trim().max(1000).optional(),
  /*
   * Only the simulator takes a number here, and only to choose which outcome
   * to act out. A real gateway collects the card on its own page precisely so
   * that a platform like this never sees one, so this is optional at the
   * schema and required by the simulated path below.
   */
  cardNumber: z.string().trim().optional(),
  idempotencyKey: z.string().trim().min(8),
});

export type CheckoutState = {
  error?: string;
  field?: string;
  /*
   * Set when a hosted gateway has to take over. The order exists and is
   * awaiting payment; the browser opens the gateway's own checkout with these
   * and comes back through confirmPaymentAction.
   */
  pay?: {
    orderId: string;
    gatewayOrderId: string;
    keyId: string;
    amountMinor: number;
    currency: string;
    email: string;
    name: string;
    phone: string;
  };
};

export async function checkoutAction(
  slug: string,
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const site = await resolveStore(slug);

  const parsed = CheckoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Something in that form isn't right.", field: String(issue?.path[0] ?? "") };
  }
  const input = parsed.data;

  if (getPaymentProvider().isSimulated && (input.cardNumber ?? "").replace(/\D/g, "").length < 12) {
    return { error: "Enter one of the test card numbers.", field: "cardNumber" };
  }

  const cartToken = await readCartToken(site.tenantId);
  if (!cartToken) return { error: "Your basket has expired. Please start again." };

  const needsAddress = Boolean(input.line1);
  const order = await placeOrder({
    tenantId: site.tenantId,
    currency: site.currency,
    cartToken,
    email: input.email,
    phone: input.phone || null,
    shippingMethodId: input.shippingMethodId,
    customerNote: input.customerNote || null,
    address: needsAddress
      ? {
          name: input.name,
          line1: input.line1!,
          line2: input.line2 || null,
          city: input.city ?? "",
          region: input.region || null,
          postalCode: input.postalCode || null,
          country: (input.country ?? "IN").toUpperCase(),
        }
      : null,
    idempotencyKey: input.idempotencyKey,
  });

  if (!order.ok) return { error: order.message };

  /*
   * Payment.
   *
   * With a real gateway the order now exists and is unpaid, and the customer
   * is handed to the gateway's own page. Nothing here decides whether they
   * paid — the webhook does, because a customer can close the tab the moment
   * the money leaves and the browser can be lied to.
   */
  const provider = getPaymentProvider();
  const intent = await provider.createPaymentIntent({
    tenantId: site.tenantId,
    orderId: order.orderId,
    amountMinor: order.totalMinor,
    currency: site.currency,
    customerEmail: input.email,
    idempotencyKey: `${input.idempotencyKey}:pay`,
    returnUrl: `/s/${slug}/order/${order.orderId}`,
  });

  if (!provider.isSimulated) {
    await recordPayment(site.tenantId, order.orderId, {
      provider: provider.id,
      reference: intent.reference,
      state: "pending",
      amountMinor: order.totalMinor,
      currency: site.currency,
    });

    revalidatePath(`/s/${slug}`, "layout");
    return {
      pay: {
        orderId: order.orderId,
        gatewayOrderId: intent.reference,
        keyId: String(intent.metadata?.keyId ?? ""),
        amountMinor: order.totalMinor,
        currency: site.currency,
        email: input.email,
        name: input.name,
        phone: input.phone ?? "",
      },
    };
  }

  /*
   * The simulator is told the outcome the test card implies, which is how a
   * real gateway's sandbox behaves — so the merchant learns the habit they
   * will need when a real one is connected. No card data is stored or even
   * passed to the provider; the number only selects which outcome to act out.
   */
  const settled = settleSimulatedPayment(intent.reference, outcomeForCard(input.cardNumber ?? ""));

  await recordPayment(site.tenantId, order.orderId, {
    provider: provider.id,
    reference: settled.reference,
    state: settled.state === "succeeded" ? "succeeded" : settled.state === "pending" ? "pending" : "failed",
    amountMinor: order.totalMinor,
    currency: site.currency,
    failureReason: settled.failureReason,
    metadata: { simulated: true },
  });

  /*
   * A declined card does not send them back to the checkout.
   *
   * Placing the order closed the basket — it has become an order — so the
   * checkout page would now find nothing and bounce them to an empty basket,
   * with their address and their basket both apparently gone. What actually
   * happened is that they have an unpaid order, so that is where they go, and
   * they can try another card against it. This is how a real gateway behaves.
   */
  revalidatePath(`/s/${slug}`, "layout");
  redirect(`/s/${slug}/order/${order.orderId}`);
}

/** Retry payment on an order that is still awaiting it. */
export async function retryPaymentAction(
  slug: string,
  orderId: string,
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const site = await resolveStore(slug);
  const cardNumber = String(formData.get("cardNumber") ?? "");
  if (cardNumber.replace(/\D/g, "").length < 12) {
    return { error: "Enter one of the test card numbers.", field: "cardNumber" };
  }

  const order = await loadOrderForPayment(site.tenantId, orderId);
  if (!order) return { error: "That order no longer exists." };
  if (order.status !== "pending_payment") {
    return { error: "This order has already been paid for." };
  }

  const provider = getPaymentProvider();
  const intent = await provider.createPaymentIntent({
    tenantId: site.tenantId,
    orderId,
    amountMinor: Number(order.totalMinor),
    currency: order.currency,
    customerEmail: order.email,
    // A retry is deliberately a NEW attempt, not a replay of the failed one.
    idempotencyKey: `${orderId}:retry:${Date.now()}`,
    returnUrl: `/s/${slug}/order/${orderId}`,
  });

  const settled = settleSimulatedPayment(intent.reference, outcomeForCard(cardNumber));

  await recordPayment(site.tenantId, orderId, {
    provider: provider.id,
    reference: settled.reference,
    state:
      settled.state === "succeeded" ? "succeeded" : settled.state === "pending" ? "pending" : "failed",
    amountMinor: Number(order.totalMinor),
    currency: order.currency,
    failureReason: settled.failureReason,
    metadata: { simulated: true, retry: true },
  });

  if (settled.state === "failed") {
    return { error: settled.failureReason ?? "That payment didn't go through.", field: "cardNumber" };
  }

  revalidatePath(`/s/${slug}/order/${orderId}`);
  return {};
}

/** A fresh key per checkout attempt, so a retry after a failure is a new order. */
export async function newIdempotencyKey(): Promise<string> {
  return randomUUID();
}

/**
 * Confirm a payment the customer just made on the gateway's own page.
 *
 * This is a courtesy, not the authority. The webhook is what marks an order
 * paid, and it arrives whether or not the browser ever comes back. What this
 * does is verify the signature the gateway handed the browser so the customer
 * sees a paid order immediately rather than a "we're checking" screen — and
 * refuses anything that is not signed, because otherwise the confirmation is
 * whatever the browser says it is.
 */
export async function confirmPaymentAction(
  slug: string,
  orderId: string,
  gatewayOrderId: string,
  gatewayPaymentId: string,
  signature: string,
): Promise<{ ok: boolean; message?: string }> {
  const site = await resolveStore(slug);

  const config = razorpayConfig();
  if (!config) return { ok: false, message: "Payments aren't configured." };

  if (!verifyCheckoutSignature(config, gatewayOrderId, gatewayPaymentId, signature)) {
    /*
     * A signature that does not check out is either a bug or somebody trying
     * to mark an order paid from the console. Either way the order stays
     * unpaid and the webhook remains the only thing that can change that.
     */
    console.error("[checkout] bad gateway signature for order", orderId);
    return { ok: false, message: "We couldn't confirm that payment. Please contact the shop." };
  }

  const intent = await razorpayProvider(config).getPaymentStatus(gatewayPaymentId);
  await recordPayment(site.tenantId, orderId, {
    provider: "razorpay",
    reference: intent.reference,
    state:
      intent.state === "succeeded" ? "succeeded" : intent.state === "pending" ? "pending" : "failed",
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    failureReason: intent.failureReason,
    metadata: { source: "checkout-return" },
  });

  revalidatePath(`/s/${slug}`, "layout");
  return { ok: true };
}
