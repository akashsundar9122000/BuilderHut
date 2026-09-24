import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { normalizePhone } from "@/lib/customers/phone";
import { checkoutGate, readPolicy } from "@/lib/customers/policy";
import { loadSession } from "@/lib/customers/session";
import { withTenant, type TenantDb } from "@/lib/db/tenant";
import {
  analyticsEvents,
  auditLogs,
  cartItems,
  carts,
  customers,
  discountRedemptions,
  discounts,
  idempotencyKeys,
  inventoryMovements,
  orderAddresses,
  orderItems,
  orders,
  payments,
  products,
  refunds,
  shippingMethods,
  taxRules,
} from "@/lib/db/schema";
import { computeTotals, type PriceableLine } from "./pricing";
import { lookupDiscount } from "./discount-lookup";
import { assertTransition, type OrderStatus } from "./order-state";

/*
 * Turning a cart into an order.
 *
 * Everything here happens in ONE transaction, because the alternatives are all
 * corrupt states: an order with no items, stock deducted for an order that was
 * never created, a payment row pointing at nothing. Blueprint section 35.1
 * lists exactly these as the cases that must be atomic.
 *
 * Prices are recomputed from the catalogue inside the transaction. The browser
 * sends a cart, never a total — a total from the client is a price the customer
 * chose.
 */

export interface PlaceOrderInput {
  tenantId: string;
  currency: string;
  cartToken: string;
  /** Absent at a shop that signs its customers in by mobile number alone. */
  email?: string | null;
  phone?: string | null;
  customerId?: string | null;
  /**
   * The customer session cookie, resolved to an id INSIDE this transaction.
   *
   * Never a customerId out of a form: a customer id from a browser is a request
   * to be somebody else, and the same rule that applies to the tenant id applies
   * here. See the header comment in the storefront actions file.
   */
  sessionToken?: string | null;
  shippingMethodId?: string | null;
  address?: {
    name: string;
    line1: string;
    line2?: string | null;
    city: string;
    region?: string | null;
    postalCode?: string | null;
    country: string;
  } | null;
  customerNote?: string | null;
  acceptsMarketing?: boolean;
  /** Deduplicates a double-click or a network retry. */
  idempotencyKey: string;
}

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: number; totalMinor: number; reused: boolean }
  | { ok: false; message: string };

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  return withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<PlaceOrderResult> => {
      /*
       * Idempotency first. A customer who double-clicks "Pay" or whose phone
       * retries the request on a flaky connection must get the same order back,
       * not a second one — and must certainly not be charged twice.
       */
      const [seen] = await db
        .select(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.scope, "place_order"),
            eq(idempotencyKeys.key, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (seen?.result) {
        const cached = seen.result as { orderId: string; orderNumber: number; totalMinor: number };
        return { ok: true, ...cached, reused: true };
      }

      /*
       * Whether this shop lets this person order at all.
       *
       * The checkout page checks the same thing and redirects, which is the
       * courtesy; this is the rule. A hidden button is not a limit — the same
       * argument lib/plans/entitlements.ts makes in its own header — and
       * checkoutMode sat in the database unread until this line existed.
       */
      const policy = await readPolicy(db);
      const session = input.sessionToken ? await loadSession(db, input.sessionToken) : null;
      const gate = checkoutGate(policy, session);
      if (!gate.ok) return { ok: false, message: gate.message };

      /*
       * A signed-in customer's contact details come from their record, not from
       * the form. Otherwise somebody signed in as one person could type another
       * person's address and have the order — and its receipts — attached to them.
       */
      const customerId = session?.customerId ?? input.customerId ?? null;
      const email = session ? session.email : (input.email ?? null);
      const phone = session ? (session.phone ?? input.phone ?? null) : (input.phone ?? null);
      if (!email && !phone) {
        return { ok: false, message: "We need an email address or a mobile number to reach you." };
      }

      const [cart] = await db.select(carts).where(eq(carts.token, input.cartToken)).limit(1);
      if (!cart) return { ok: false, message: "Your basket has expired. Please start again." };
      if (cart.convertedOrderId) {
        return { ok: false, message: "That basket has already been ordered." };
      }

      const items = await db.select(cartItems).where(eq(cartItems.cartId, cart.id));
      if (items.length === 0) return { ok: false, message: "Your basket is empty." };

      // Lock the products being bought. Without FOR UPDATE two simultaneous
      // checkouts can both read stock of 1 and both succeed.
      const catalogue = await db
        .select(products)
        .where(isNull(products.deletedAt))
        .for("update");
      const byId = new Map(catalogue.map((p) => [p.id, p]));

      const priceable: PriceableLine[] = [];
      for (const item of items) {
        const product = byId.get(item.productId);
        if (!product || product.status !== "active") {
          return { ok: false, message: `"${product?.name ?? "An item"}" is no longer available.` };
        }
        if (product.trackStock && item.quantity > product.stock) {
          return {
            ok: false,
            message:
              product.stock === 0
                ? `"${product.name}" has sold out.`
                : `Only ${product.stock} of "${product.name}" left.`,
          };
        }
        priceable.push({
          productId: product.id,
          name: product.name,
          unitPriceMinor: Number(product.priceMinor),
          quantity: item.quantity,
          requiresShipping: product.requiresShipping,
        });
      }

      let shipping = null;
      let shippingName: string | null = null;
      let isPickup = false;
      if (input.shippingMethodId) {
        const [method] = await db
          .select(shippingMethods)
          .where(eq(shippingMethods.id, input.shippingMethodId))
          .limit(1);
        if (!method || !method.active) {
          return { ok: false, message: "That delivery option is no longer offered." };
        }
        shippingName = method.name;
        isPickup = method.isPickup;
        shipping = {
          id: method.id,
          name: method.name,
          kind: method.kind,
          priceMinor: Number(method.priceMinor),
          thresholdMinor: method.thresholdMinor == null ? null : Number(method.thresholdMinor),
          isPickup: method.isPickup,
        };
      }

      const rules = await db.select(taxRules).where(eq(taxRules.active, true));
      const rule = rules[0]
        ? { name: rules[0].name, rateBasisPoints: rules[0].rateBasisPoints, inclusive: rules[0].inclusive }
        : null;

      /*
       * The code is validated again here, inside the transaction that creates
       * the order. Between the basket page and this moment a code can expire,
       * be switched off, or hit its redemption limit — and the redemption
       * counter has to be incremented in the same transaction as the order, or
       * a limited code can be over-redeemed by simultaneous checkouts.
       */
      let discount = null;
      let discountRow = null;
      if (cart.discountCode) {
        const found = await lookupDiscount(db, cart.discountCode);
        if (found.ok) {
          discount = found.discount;
          [discountRow] = await db
            .select(discounts)
            .where(eq(discounts.code, found.discount.code))
            .for("update")
            .limit(1);
          // Re-read under the lock: another checkout may have taken the last one.
          if (
            discountRow &&
            discountRow.maxRedemptions !== null &&
            discountRow.redemptions >= discountRow.maxRedemptions
          ) {
            discount = null;
            discountRow = null;
          }
        }
      }

      const totals = computeTotals({ lines: priceable, shipping, taxRule: rule, discount });

      const needsAddress = priceable.some((l) => l.requiresShipping) && !isPickup;
      if (needsAddress && !input.address) {
        return { ok: false, message: "We need a delivery address." };
      }

      /*
       * Order numbers are per tenant and human-quotable: "#1043", not a uuid.
       * MAX+1 inside this transaction is safe because the transaction is
       * serialised on the products lock above; two checkouts cannot both read
       * the same maximum.
       */
      const [latest] = await db.select(orders).orderBy(desc(orders.number)).limit(1);
      const orderNumber = (latest?.number ?? 1000) + 1;
      const orderId = uuidv7();

      await db.insert(orders, {
        id: orderId,
        number: orderNumber,
        customerId,
        email: email ? email.trim().toLowerCase() : null,
        phone,
        status: "pending_payment",
        currency: input.currency,
        subtotalMinor: BigInt(totals.subtotalMinor),
        discountMinor: BigInt(totals.discountMinor),
        shippingMinor: BigInt(totals.shippingMinor),
        taxMinor: BigInt(totals.taxMinor),
        totalMinor: BigInt(totals.totalMinor),
        fulfilment: isPickup ? "pickup" : needsAddress ? "delivery" : "digital",
        shippingMethodName: shippingName,
        discountCode: totals.discountCode,
        customerNote: input.customerNote ?? null,
        placedAt: new Date(),
      });

      // Snapshot every line. Blueprint section 35.1: an old order must never
      // depend on today's product to explain what was bought.
      await db.insertMany(
        orderItems,
        totals.lines.map((line) => {
          const product = byId.get(line.productId)!;
          return {
            id: uuidv7(),
            orderId,
            productId: line.productId,
            productName: line.name,
            sku: product.sku,
            unitPriceMinor: BigInt(line.unitPriceMinor),
            quantity: line.quantity,
            lineDiscountMinor: BigInt(line.lineDiscountMinor),
            lineTaxMinor: BigInt(line.lineTaxMinor),
            lineTotalMinor: BigInt(line.lineTotalMinor),
            currency: input.currency,
          };
        }),
      );

      if (input.address) {
        await db.insert(orderAddresses, {
          id: uuidv7(),
          orderId,
          kind: "shipping",
          name: input.address.name,
          phone,
          line1: input.address.line1,
          line2: input.address.line2 ?? null,
          city: input.address.city,
          region: input.address.region ?? null,
          postalCode: input.address.postalCode ?? null,
          country: input.address.country,
        });
      }

      /*
       * Stock comes off now, not on payment. An unpaid order holds its stock
       * for as long as it is open — which is what stops two people buying the
       * last one while the first is still typing their card number. Cancelling
       * returns it.
       */
      for (const line of totals.lines) {
        const product = byId.get(line.productId)!;
        if (!product.trackStock) continue;
        const balanceAfter = product.stock - line.quantity;
        await db.update(products, { stock: balanceAfter }, eq(products.id, product.id));
        await db.insert(inventoryMovements, {
          id: uuidv7(),
          productId: product.id,
          delta: -line.quantity,
          balanceAfter,
          reason: "sale",
          orderId,
        });
      }

      if (discountRow && totals.discountMinor >= 0 && totals.discountCode) {
        await db.update(
          discounts,
          { redemptions: discountRow.redemptions + 1 },
          eq(discounts.id, discountRow.id),
        );
        await db.insert(discountRedemptions, {
          id: uuidv7(),
          discountId: discountRow.id,
          orderId,
          customerId,
          amountMinor: BigInt(totals.discountMinor),
        });
      }

      await db.update(carts, { convertedOrderId: orderId }, eq(carts.id, cart.id));

      await db.insert(idempotencyKeys, {
        id: uuidv7(),
        scope: "place_order",
        key: input.idempotencyKey,
        result: { orderId, orderNumber, totalMinor: totals.totalMinor },
      });

      await db.raw.insert(auditLogs).values({
        id: uuidv7(),
        tenantId: input.tenantId,
        action: "order.placed",
        entityType: "order",
        entityId: orderId,
        metadata: { orderNumber, totalMinor: totals.totalMinor, currency: input.currency },
      });

      return {
        ok: true,
        orderId,
        orderNumber,
        totalMinor: totals.totalMinor,
        reused: false,
      };
    },
  );
}

/** Records a payment and moves the order, or records the failure. */
export async function recordPayment(
  tenantId: string,
  orderId: string,
  payment: {
    provider: string;
    reference: string;
    state: "succeeded" | "failed" | "pending" | "cancelled";
    amountMinor: number;
    currency: string;
    failureReason?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; status?: OrderStatus; message?: string }> {
  return withTenant(
    { tenantId, actorId: tenantId, role: "staff" },
    async (db): Promise<{ ok: boolean; status?: OrderStatus; message?: string }> => {
      const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { ok: false, message: "That order no longer exists." };

      const [existing] = await db
        .select(payments)
        .where(
          and(eq(payments.provider, payment.provider), eq(payments.providerRef, payment.reference)),
        )
        .limit(1);

      if (existing) {
        await db.update(
          payments,
          { status: payment.state, failureReason: payment.failureReason ?? null },
          eq(payments.id, existing.id),
        );
      } else {
        await db.insert(payments, {
          id: uuidv7(),
          orderId,
          provider: payment.provider,
          providerRef: payment.reference,
          status: payment.state,
          amountMinor: BigInt(payment.amountMinor),
          currency: payment.currency,
          failureReason: payment.failureReason ?? null,
          metadata: payment.metadata ?? null,
        });
      }

      if (payment.state !== "succeeded") {
        // A failed payment leaves the order awaiting payment so the customer
        // can try a different card, rather than destroying it under them.
        return { ok: true, status: order.status as OrderStatus };
      }

      // Already paid: a repeated webhook or a refreshed success page.
      if (order.status !== "pending_payment") {
        return { ok: true, status: order.status as OrderStatus };
      }

      assertTransition(order.status as OrderStatus, "paid");
      await db.update(orders, { status: "paid", paidAt: new Date() }, eq(orders.id, orderId));

      /*
       * Attach the order to a customer record, creating one if this is a guest.
       *
       * This is the shadow ledger a returning shopper later claims: they sign in
       * with the address they checked out with, prove it with a code, and their
       * past orders are there. Matching is on whichever identifier the order
       * actually carries — a phone-only store has no email to match on.
       *
       * Nothing here sets emailVerified or phoneVerified. Checking out proves a
       * card, not an address, and treating it as proof would hand the history to
       * whoever typed the address next.
       */
      if (!order.customerId) {
        const email = order.email?.trim().toLowerCase() || null;
        // Already normalised on the way in, but a row written before that was
        // true may not be; a number that will not normalise is left off rather
        // than stored in a shape the column no longer allows. No default country
        // here on purpose: guessing one for an existing row would invent digits.
        const typed = order.phone ? normalizePhone(order.phone, "") : null;
        const phone = typed?.ok ? typed.e164 : null;

        // One lookup per identifier the order carries. Email wins where both
        // match different rows: it is the one the confirmation went to.
        const [byEmail] = email
          ? await db
              .select(customers)
              .where(sql`lower(${customers.email}) = ${email}`)
              .limit(1)
          : [];
        const [byPhone] = phone
          ? await db.select(customers).where(eq(customers.phone, phone)).limit(1)
          : [];

        let customerId = byEmail?.id ?? byPhone?.id;
        if (!customerId) {
          // Neither matched, so the number belongs to nobody here yet and the
          // new row can hold it. One number is one account per shop.
          customerId = uuidv7();
          await db.insert(customers, { id: customerId, email, phone });
        }
        await db.update(orders, { customerId }, eq(orders.id, orderId));
      }

      await db.raw.insert(auditLogs).values({
        id: uuidv7(),
        tenantId,
        action: "order.paid",
        entityType: "order",
        entityId: orderId,
        metadata: { reference: payment.reference, amountMinor: payment.amountMinor },
      });

      /*
       * Written directly rather than through track(): this runs inside the
       * transaction that marked the order paid, so the revenue figure and the
       * order status can never disagree. track() opens its own transaction,
       * which withTenant would rightly refuse from in here.
       */
      await db.insert(analyticsEvents, {
        id: uuidv7(),
        name: "order_paid",
        valueMinor: order.totalMinor,
        currency: order.currency,
      });

      return { ok: true, status: "paid" };
    },
  );
}

/** Returns stock for every line of an order. Used when cancelling or refunding. */
async function returnStock(db: TenantDb, orderId: string, reason: "cancellation" | "refund") {
  const lines = await db.select(orderItems).where(eq(orderItems.orderId, orderId));
  for (const line of lines) {
    if (!line.productId) continue;
    const [product] = await db
      .select(products)
      .where(eq(products.id, line.productId))
      .for("update")
      .limit(1);
    if (!product?.trackStock) continue;

    const balanceAfter = product.stock + line.quantity;
    await db.update(products, { stock: balanceAfter }, eq(products.id, product.id));
    await db.insert(inventoryMovements, {
      id: uuidv7(),
      productId: product.id,
      delta: line.quantity,
      balanceAfter,
      reason,
      orderId,
    });
  }
}

export async function transitionOrder(
  tenantId: string,
  actorId: string,
  orderId: string,
  to: OrderStatus,
): Promise<{ ok: boolean; message?: string }> {
  return withTenant(
    { tenantId, actorId, role: "owner" },
    async (db): Promise<{ ok: boolean; message?: string }> => {
      const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { ok: false, message: "That order no longer exists." };

      const from = order.status as OrderStatus;
      try {
        assertTransition(from, to);
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      }

      const stamps: Record<string, Date> = {};
      if (to === "shipped") stamps.shippedAt = new Date();
      if (to === "delivered") stamps.deliveredAt = new Date();
      if (to === "cancelled") stamps.cancelledAt = new Date();

      await db.update(orders, { status: to, ...stamps }, eq(orders.id, orderId));

      if (to === "cancelled") await returnStock(db, orderId, "cancellation");

      await db.raw.insert(auditLogs).values({
        id: uuidv7(),
        tenantId,
        actorId,
        action: "order.status_changed",
        entityType: "order",
        entityId: orderId,
        metadata: { from, to },
      });

      return { ok: true };
    },
  );
}

export async function refundOrder(
  tenantId: string,
  actorId: string,
  orderId: string,
  amountMinor: number,
  reason?: string,
): Promise<{ ok: boolean; message?: string }> {
  return withTenant(
    { tenantId, actorId, role: "owner" },
    async (db): Promise<{ ok: boolean; message?: string }> => {
      const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) return { ok: false, message: "That order no longer exists." };

      const alreadyRefunded = Number(order.refundedMinor);
      const total = Number(order.totalMinor);
      if (amountMinor <= 0) return { ok: false, message: "A refund has to be for something." };
      if (alreadyRefunded + amountMinor > total) {
        return { ok: false, message: "That is more than is left to refund on this order." };
      }

      const nowRefunded = alreadyRefunded + amountMinor;
      const full = nowRefunded >= total;
      const to: OrderStatus = full ? "refunded" : "partially_refunded";

      try {
        assertTransition(order.status as OrderStatus, to);
      } catch (error) {
        return { ok: false, message: (error as Error).message };
      }

      const [payment] = await db.select(payments).where(eq(payments.orderId, orderId)).limit(1);

      await db.insert(refunds, {
        id: uuidv7(),
        orderId,
        paymentId: payment?.id ?? null,
        amountMinor: BigInt(amountMinor),
        currency: order.currency,
        reason: reason ?? null,
        createdBy: actorId,
      });

      await db.update(
        orders,
        { refundedMinor: BigInt(nowRefunded), status: to },
        eq(orders.id, orderId),
      );

      if (payment) {
        await db.update(
          payments,
          { status: full ? "refunded" : "partially_refunded" },
          eq(payments.id, payment.id),
        );
      }

      // A full refund puts the goods back; a partial one is usually a gesture
      // rather than a return, so stock is left alone.
      if (full) await returnStock(db, orderId, "refund");

      await db.raw.insert(auditLogs).values({
        id: uuidv7(),
        tenantId,
        actorId,
        action: "order.refunded",
        entityType: "order",
        entityId: orderId,
        metadata: { amountMinor, full, reason },
      });

      return { ok: true };
    },
  );
}

export async function countOrderRevenue(tenantId: string) {
  return withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
    const rows = await db.select(orders).limit(1000);
    const counted = rows.filter(
      (o) => !["pending_payment", "cancelled", "refunded"].includes(o.status),
    );
    return {
      orders: counted.length,
      pending: rows.filter((o) => o.status === "pending_payment").length,
      grossMinor: counted.reduce((sum, o) => sum + Number(o.totalMinor), 0),
      refundedMinor: rows.reduce((sum, o) => sum + Number(o.refundedMinor), 0),
      netMinor:
        counted.reduce((sum, o) => sum + Number(o.totalMinor), 0) -
        rows.reduce((sum, o) => sum + Number(o.refundedMinor), 0),
    };
  });
}

/** The minimum an unpaid order needs for a payment retry. */
export async function loadOrderForPayment(tenantId: string, orderId: string) {
  return withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
    const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
    return order ?? null;
  });
}
