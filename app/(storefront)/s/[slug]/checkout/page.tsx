import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import { CheckoutForm, type ShippingChoice } from "@/components/storefront/CheckoutForm";
import { StoreFooter, StoreHeader, StorePageShell } from "@/components/storefront/StoreChrome";
import { getCart } from "@/lib/commerce/cart";
import { getPaymentProvider } from "@/lib/payments/dummy";
import { withTenant } from "@/lib/db/tenant";
import { shippingMethods, storeSettings } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { homePage } from "@/lib/schema/page";
import { loadStorefront } from "@/lib/stores/storefront";
import { after } from "next/server";
import { track, trackContext } from "@/lib/analytics/track";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStorefront(slug);
  if (!store) notFound();

  const cart = await getCart(store.tenantId, store.currency);
  // Nothing to check out. Sending them to the basket explains itself.
  if (cart.lines.length === 0) redirect(`/s/${slug}/cart`);

  const measured = await trackContext();
  after(() =>
    track(store.tenantId, "checkout_start", measured, {
      path: "/checkout",
      valueMinor: cart.totals.totalMinor,
      currency: store.currency,
    }),
  );

  const { methods, settings } = await withTenant(
    { tenantId: store.tenantId, actorId: store.tenantId, role: "staff" },
    async (db) => ({
      methods: await db
        .select(shippingMethods)
        .where(eq(shippingMethods.active, true))
        .orderBy(shippingMethods.position),
      settings: (await db.select(storeSettings).limit(1))[0] ?? null,
    }),
  );

  const choices: ShippingChoice[] = methods.map((method) => ({
    id: method.id,
    name: method.name,
    description: method.description,
    priceLabel:
      method.isPickup || method.kind === "free" || Number(method.priceMinor) === 0
        ? "Free"
        : method.kind === "free_over" && method.thresholdMinor != null
          ? `${formatMoney(method.priceMinor, store.currency)} · free over ${formatMoney(method.thresholdMinor, store.currency)}`
          : formatMoney(method.priceMinor, store.currency),
    isPickup: method.isPickup,
  }));

  const ctx = { doc: store.doc, base: `/s/${store.slug}`, products: store.products, editing: false };
  const home = homePage(store.doc);

  return (
    <>
      <StoreHeader page={home} ctx={ctx} />
      <StorePageShell title="Checkout" wide>
        <CheckoutForm
          slug={store.slug}
          cart={cart}
          shipping={choices}
          /*
           * A key generated per page load. A double-click submits the same key
           * and gets the same order back; a genuine second attempt after a
           * declined card reloads this page and gets a new one.
           */
          idempotencyKey={randomUUID()}
          requirePhone={settings?.requirePhone ?? true}
          allowNotes={settings?.allowOrderNotes ?? true}
          /*
           * Decided on the server from what is configured, not from a setting
           * a merchant could get wrong. A shop that believes it is taking
           * money and is not is the worst outcome this screen can produce.
           */
          simulated={getPaymentProvider().isSimulated}
          shopName={store.doc.settings.storeName}
        />
      </StorePageShell>
      <StoreFooter page={home} ctx={ctx} />
    </>
  );
}
