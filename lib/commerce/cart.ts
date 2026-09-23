import "server-only";

import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { uuidv7 } from "uuidv7";

import { withTenant, type TenantDb } from "@/lib/db/tenant";
import { cartItems, carts, products, shippingMethods, taxRules } from "@/lib/db/schema";
import { computeTotals, type CartTotals, type PriceableLine } from "./pricing";

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

async function writeCartToken(tenantId: string, token: string): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(tenantId), token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure only over HTTPS: Safari drops Secure cookies on plain localhost,
    // which would make the cart silently fail to persist in development.
    secure: process.env.NODE_ENV === "production",
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
        imageUrl: null as string | null,
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

  return computeTotals({ lines: priceable, shipping, taxRule: rule });
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
    const totals = await priceCart(db, lines, shippingMethodId);
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

/** Marks a cart as converted so it can never be checked out twice. */
export async function closeCart(db: TenantDb, cartId: string, orderId: string): Promise<void> {
  await db.update(carts, { convertedOrderId: orderId }, eq(carts.id, cartId));
}

export async function clearCartCookie(tenantId: string): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName(tenantId));
}
