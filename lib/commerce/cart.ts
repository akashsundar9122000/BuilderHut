import "server-only";

import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { uuidv7 } from "uuidv7";

import { withTenant, type TenantDb } from "@/lib/db/tenant";
import { isSecureRequest } from "@/lib/http/secure-request";
import {
  cartItems,
  carts,
  productImages,
  products,
  shippingMethods,
  taxRules,
} from "@/lib/db/schema";
import { imageUrlFor } from "@/lib/products/service";
import { computeTotals, type CartTotals, type PriceableLine } from "./pricing";
import { lookupDiscount } from "./discount-lookup";

/*
 * The cart.
 *
 * Prices are read from the database every time totals are computed, never
 * stored on the cart row. A cart that remembered a price would let someone add
 * an item, wait for a sale to end, and still check out at the old figure — and
 * would also show a stale price to someone who simply left the tab open.
 *
 * The cookie is per store. A visitor browsing two BuilderHut shops has two
 * carts, which is what they would expect; one shared cookie would hand a cart
 * to the wrong merchant.
 */

const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function cookieName(tenantId: string): string {
  return `bh_cart_${tenantId}`;
}

export interface CartLine {
  productId: string;
  name: string;
  slug: string;
  unitPriceMinor: number;
  quantity: number;
  imageUrl: string | null;
  requiresShipping: boolean;
  /** Null when the merchant does not track stock for this product. */
  available: number | null;
}

export interface CartView {
  id: string | null;
  lines: CartLine[];
  totals: CartTotals;
  currency: string;
  itemCount: number;
}

/** Reads the cart cookie without creating anything. */
export async function readCartToken(tenantId: string): Promise<string | null> {
  const jar = await cookies();
  return jar.get(cookieName(tenantId))?.value ?? null;
}

/*
 * Exported because signing in can move the basket.
 *
 * attachCartToCustomer() may hand back a different cart's token — the one they
 * filled on another device — and the cookie has to follow, or getCart() looks up
 * the old token and reports an empty basket over a row that is right there.
 */
export async function writeCartToken(tenantId: string, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(tenantId), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isSecureRequest(),
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

/** Loads the cart's lines, priced from the live catalogue. */
async function loadLines(db: TenantDb, cartId: string): Promise<CartLine[]> {
  const rows = await db.select(cartItems).where(eq(cartItems.cartId, cartId));
  if (rows.length === 0) return [];

  const catalogue = await db.select(products).where(isNull(products.deletedAt));
  const byId = new Map(catalogue.map((p) => [p.id, p]));

  // The main picture for each line, so a basket shows what is in it rather
  // than a row of grey squares.
  const images = await db.select(productImages).orderBy(productImages.position);
  const firstImage = new Map<string, string>();
  for (const image of images) {
    if (!firstImage.has(image.productId)) {
      firstImage.set(image.productId, imageUrlFor(image.mediaKey));
    }
  }

  return rows
    .map((item) => {
      const product = byId.get(item.productId);
      // A product deleted or unpublished since it was added simply drops out
      // rather than blocking the whole cart.
      if (!product || product.status !== "active") return null;
      return {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        unitPriceMinor: Number(product.priceMinor),
        quantity: item.quantity,
        imageUrl: firstImage.get(product.id) ?? null,
        requiresShipping: product.requiresShipping,
        available: product.trackStock ? product.stock : null,
      } satisfies CartLine;
    })
    .filter((line): line is CartLine => line !== null);
}

async function priceCart(
  db: TenantDb,
  lines: CartLine[],
  shippingMethodId?: string | null,
  discountCode?: string | null,
): Promise<CartTotals> {
  const priceable: PriceableLine[] = lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    unitPriceMinor: line.unitPriceMinor,
    quantity: line.quantity,
    requiresShipping: line.requiresShipping,
  }));

  let shipping = null;
  if (shippingMethodId) {
    const [method] = await db
      .select(shippingMethods)
      .where(eq(shippingMethods.id, shippingMethodId))
      .limit(1);
    if (method) {
      shipping = {
        id: method.id,
        name: method.name,
        kind: method.kind,
        priceMinor: Number(method.priceMinor),
        thresholdMinor: method.thresholdMinor == null ? null : Number(method.thresholdMinor),
        isPickup: method.isPickup,
      };
    }
  }

  const rules = await db.select(taxRules).where(eq(taxRules.active, true));
  const rule = rules[0]
    ? {
        name: rules[0].name,
        rateBasisPoints: rules[0].rateBasisPoints,
        inclusive: rules[0].inclusive,
      }
    : null;

  // Re-checked here rather than trusted from the cart row: a code switched off
  // since it was entered must stop applying.
  let discount = null;
  if (discountCode) {
    const found = await lookupDiscount(db, discountCode);
    if (found.ok) discount = found.discount;
  }

  return computeTotals({ lines: priceable, shipping, taxRule: rule, discount });
}

export async function getCart(
  tenantId: string,
  currency: string,
  shippingMethodId?: string | null,
): Promise<CartView> {
  const token = await readCartToken(tenantId);
  if (!token) {
    return {
      id: null,
      lines: [],
      totals: computeTotals({ lines: [] }),
      currency,
      itemCount: 0,
    };
  }

  return withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
    const [cart] = await db.select(carts).where(eq(carts.token, token)).limit(1);
    if (!cart || cart.convertedOrderId) {
      return {
        id: null,
        lines: [],
        totals: computeTotals({ lines: [] }),
        currency,
        itemCount: 0,
      };
    }

    const lines = await loadLines(db, cart.id);
    const totals = await priceCart(db, lines, shippingMethodId, cart.discountCode);
    return {
      id: cart.id,
      lines,
      totals,
      currency: cart.currency,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    };
  });
}

export type CartMutation =
  | { ok: true; cart: CartView }
  | { ok: false; message: string };

export async function addToCart(
  tenantId: string,
  currency: string,
  productId: string,
  quantity = 1,
): Promise<CartMutation> {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false, message: "Choose a quantity between 1 and 99." };
  }

  let token = await readCartToken(tenantId);
  const isNew = !token;
  token ??= randomBytes(24).toString("base64url");

  const result = await withTenant(
    { tenantId, actorId: tenantId, role: "staff" },
    async (db): Promise<{ ok: boolean; message?: string }> => {
      const [product] = await db
        .select(products)
        .where(and(eq(products.id, productId), isNull(products.deletedAt)))
        .limit(1);
      if (!product || product.status !== "active") {
        return { ok: false, message: "That item is no longer available." };
      }

      let [cart] = await db.select(carts).where(eq(carts.token, token!)).limit(1);
      if (!cart || cart.convertedOrderId) {
        [cart] = await db.insert(carts, { id: uuidv7(), token: token!, currency });
      }

      const [existing] = await db
        .select(cartItems)
        .where(and(eq(cartItems.cartId, cart!.id), eq(cartItems.productId, productId)))
        .limit(1);

      const wanted = (existing?.quantity ?? 0) + quantity;

      // Stock is checked here for a useful message, and again inside the order
      // transaction — this check races, that one does not.
      if (product.trackStock && wanted > product.stock) {
        return {
          ok: false,
          message:
            product.stock === 0
              ? "That one has sold out."
              : `Only ${product.stock} left, sorry.`,
        };
      }

      if (existing) {
        await db.update(cartItems, { quantity: wanted }, eq(cartItems.id, existing.id));
      } else {
        await db.insert(cartItems, {
          id: uuidv7(),
          cartId: cart!.id,
          productId,
          quantity,
        });
      }
      return { ok: true };
    },
  );

  if (!result.ok) return { ok: false, message: result.message ?? "That didn't work." };
  if (isNew) await writeCartToken(tenantId, token);
  return { ok: true, cart: await getCart(tenantId, currency) };
}

export async function setCartQuantity(
  tenantId: string,
  currency: string,
  productId: string,
  quantity: number,
): Promise<CartMutation> {
  const token = await readCartToken(tenantId);
  if (!token) return { ok: false, message: "Your basket has expired." };
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    return { ok: false, message: "Choose a quantity between 0 and 99." };
  }

  await withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
    const [cart] = await db.select(carts).where(eq(carts.token, token)).limit(1);
    if (!cart) return;

    if (quantity === 0) {
      await db.delete(
        cartItems,
        and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId))!,
      );
      return;
    }
    await db.update(
      cartItems,
      { quantity },
      and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId))!,
    );
  });

  return { ok: true, cart: await getCart(tenantId, currency) };
}

/*
 * Signing in, and the basket that was already there.
 *
 * A cart belongs either to a signed-in customer or to an anonymous visitor
 * holding a cookie token, and the schema keeps both because somebody who fills a
 * basket and then signs in must not lose it.
 *
 * Returns the token the caller has to put in the cookie, or null to leave it
 * alone. That return value is load-bearing: getCart() finds a cart by its token
 * and by nothing else, so a customer cart adopted at sign-in is invisible until
 * the cookie points at it — the row is right there and the basket looks empty.
 */
export async function attachCartToCustomer(
  db: TenantDb,
  customerId: string,
  guestToken: string | null,
): Promise<string | null> {
  const [guest] = guestToken
    ? await db
        .select(carts)
        .where(and(eq(carts.token, guestToken), isNull(carts.convertedOrderId)))
        .limit(1)
    : [];

  const [mine] = await db
    .select(carts)
    .where(and(eq(carts.customerId, customerId), isNull(carts.convertedOrderId)))
    .orderBy(desc(carts.updatedAt))
    .limit(1);

  // Nothing to reconcile.
  if (!guest && !mine) return null;

  // Only what they were carrying: claim it and keep the cookie as it is.
  if (guest && !mine) {
    await db.update(carts, { customerId }, eq(carts.id, guest.id));
    return null;
  }

  // Only what they left behind last time — on another device, probably. Point
  // the cookie at it.
  if (!guest && mine) return mine.token;

  if (!guest || !mine) return null;
  // Both. The customer's own cart survives, because it is the one with history.
  const guestLines = await db.select(cartItems).where(eq(cartItems.cartId, guest.id));
  const mineLines = await db.select(cartItems).where(eq(cartItems.cartId, mine.id));
  const byProduct = new Map(mineLines.map((line) => [line.productId, line]));

  const stock = await db.select(products).where(isNull(products.deletedAt));
  const ceilingFor = (productId: string): number => {
    const product = stock.find((p) => p.id === productId);
    if (!product || product.status !== "active") return 0;
    return product.trackStock ? Math.min(99, product.stock) : 99;
  };

  for (const line of guestLines) {
    const existing = byProduct.get(line.productId);
    /*
     * The larger of the two, never the sum.
     *
     * Two added on a phone and two on a laptop is two, not four. Summing is the
     * failure nobody forgives: it silently doubles what somebody pays, and they
     * find out from the invoice.
     */
    const wanted = Math.max(line.quantity, existing?.quantity ?? 0);
    const quantity = Math.max(0, Math.min(wanted, ceilingFor(line.productId)));
    if (quantity === 0) continue;

    if (existing) {
      if (quantity !== existing.quantity) {
        await db.update(cartItems, { quantity }, eq(cartItems.id, existing.id));
      }
    } else {
      await db.insert(cartItems, { cartId: mine.id, productId: line.productId, quantity });
    }
  }

  // A discount the visitor had typed carries over only into an empty slot.
  // placeOrder re-validates it under lock anyway, so this cannot grant anything.
  if (guest.discountCode && !mine.discountCode) {
    await db.update(carts, { discountCode: guest.discountCode }, eq(carts.id, mine.id));
  }

  // The guest cart never became an order, so leaving it would squat on
  // carts_token_key and be found again by the next visitor holding that cookie.
  await db.delete(cartItems, eq(cartItems.cartId, guest.id));
  await db.delete(carts, eq(carts.id, guest.id));

  return mine.token;
}

/** Marks a cart as converted so it can never be checked out twice. */
export async function closeCart(db: TenantDb, cartId: string, orderId: string): Promise<void> {
  await db.update(carts, { convertedOrderId: orderId }, eq(carts.id, cartId));
}

export async function clearCartCookie(tenantId: string): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName(tenantId));
}

export type DiscountResult = { ok: boolean; message?: string; cart: CartView };

/** Attach or clear a discount code on the basket. */
export async function applyDiscountCode(
  tenantId: string,
  currency: string,
  code: string | null,
): Promise<DiscountResult> {
  const token = await readCartToken(tenantId);
  if (!token) return { ok: false, message: "Your basket has expired.", cart: await getCart(tenantId, currency) };

  const outcome = await withTenant(
    { tenantId, actorId: tenantId, role: "staff" },
    async (db): Promise<{ ok: boolean; message?: string }> => {
      const [cart] = await db.select(carts).where(eq(carts.token, token)).limit(1);
      if (!cart) return { ok: false, message: "Your basket has expired." };

      if (code === null) {
        await db.update(carts, { discountCode: null }, eq(carts.id, cart.id));
        return { ok: true };
      }

      const found = await lookupDiscount(db, code);
      if (!found.ok) return { ok: false, message: found.reason };

      await db.update(carts, { discountCode: found.discount.code }, eq(carts.id, cart.id));
      return { ok: true };
    },
  );

  const cart = await getCart(tenantId, currency);
  /*
   * A code that is real but does not apply yet — below its minimum basket —
   * is accepted and explained rather than rejected. "Spend ₹200 more" is a
   * useful thing to be told; "invalid code" is not.
   */
  if (outcome.ok && cart.totals.discountRejected === "min_subtotal") {
    return { ok: true, message: "That code needs a bigger basket. It'll apply once you reach the minimum.", cart };
  }
  return { ...outcome, cart };
}
