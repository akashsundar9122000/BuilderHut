"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { confirmPaymentAction } from "@/app/(storefront)/s/[slug]/actions";

/*
 * Handing the customer to the gateway's own checkout.
 *
 * The widget is loaded from Razorpay rather than bundled, because it is what
 * collects the card and it has to be the current one — a pinned copy of a
 * payment form is a copy that stops accepting a card network the week it
 * changes.
 *
 * Whatever happens here, the order already exists and is awaiting payment. The
 * webhook is what marks it paid; this only shortens the wait for the customer
 * looking at the screen, and hands them to the order page either way.
 */

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  prefill: { email: string; contact: string; name: string };
  handler: (response: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

export function GatewayCheckout({
  slug,
  pay,
  shopName,
}: {
  slug: string;
  pay: {
    orderId: string;
    gatewayOrderId: string;
    keyId: string;
    amountMinor: number;
    currency: string;
    email: string;
    name: string;
    phone: string;
  };
  shopName: string;
}) {
  const router = useRouter();
  // Opening twice would put two payment sheets over each other, and React
  // renders this component again every time the parent's state changes.
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    let cancelled = false;

    void (async () => {
      const ready = await loadScript();
      if (cancelled) return;

      if (!ready || !window.Razorpay) {
        /*
         * The gateway could not load — an ad blocker, a bad connection. The
         * order exists and is payable, so the order page is where they can try
         * again rather than a dead end on the checkout.
         */
        router.push(`/s/${slug}/order/${pay.orderId}`);
        return;
      }

      const accent =
        getComputedStyle(document.documentElement).getPropertyValue("--sf-primary").trim() ||
        "#1c1917";

      new window.Razorpay({
        key: pay.keyId,
        amount: pay.amountMinor,
        currency: pay.currency,
        order_id: pay.gatewayOrderId,
        name: shopName,
        prefill: { email: pay.email, contact: pay.phone, name: pay.name },
        theme: { color: accent },
        handler: (response) => {
          void confirmPaymentAction(
            slug,
            pay.orderId,
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature,
          ).finally(() => router.push(`/s/${slug}/order/${pay.orderId}`));
        },
        modal: {
          // Closing the sheet is not a failure: the order is waiting, and the
          // order page is where it can be paid.
          ondismiss: () => router.push(`/s/${slug}/order/${pay.orderId}`),
        },
      }).open();
    })();

    return () => {
      cancelled = true;
    };
  }, [pay, router, shopName, slug]);

  return (
    <p role="status" style={{ marginTop: 18, color: "var(--sf-muted)", fontSize: "0.9rem" }}>
      Opening secure payment…
    </p>
  );
}
