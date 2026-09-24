import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import {
  customerAddresses,
  orderItems,
  orders,
  productImages,
  products,
  wishlistItems,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { imageUrlFor } from "@/lib/products/service";
import type {
  AccountContext,
  AccountOrderCard,
  AccountSummary,
  ProductCard,
  RenderContext,
  SignedInCustomer,
} from "@/lib/render/context";
import { loadPolicy } from "@/lib/customers/policy";
import { getCustomer, type CustomerSession } from "@/lib/customers/session";
import { loadStorefront, renderContextFor, type StorefrontData } from "@/lib/stores/storefront";

/*
 * Loading a customer-account page.
 *
 * The one place a RenderContext gets its `account` field, so no section ever
 * fetches anything itself — the same discipline that keeps a page render to one
 * set of queries rather than N.
 */

/**
 * Only a path inside this store.
 *
 * safeHref() is not enough here: it permits an absolute https: URL by design, and
 * ?next= is exactly where an open redirect lives. A sign-in page that forwards
 * somewhere else after signing somebody in is a phishing page wearing the shop's
 * own branding.
 */
export function safeNext(value: string | undefined | null, fallback = "/account"): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  // "//evil.example" is protocol-relative and leaves the site.
  if (value.startsWith("//")) return fallback;
  if (value.includes("://") || /[\r\n]/.test(value)) return fallback;
  return value;
}

function toSignedIn(session: CustomerSession): SignedInCustomer {
  return {
    id: session.customerId,
    name: session.name,
    email: session.email,
    phone: session.phone,
    emailVerified: session.emailVerified,
    phoneVerified: session.phoneVerified,
  };
}

async function accountContextFor(
  store: StorefrontData,
  session: CustomerSession | null,
  next: string | null,
  summary?: AccountSummary,
): Promise<AccountContext> {
  const policy = await loadPolicy(store.tenantId);
  return {
    slug: store.slug,
    policy: {
      identifier: policy.identifier,
      credential: policy.credential,
      verification: policy.verification,
      defaultCountry: policy.country,
    },
    customer: session ? toSignedIn(session) : null,
    next,
    summary,
  };
}

export interface AuthPageData {
  store: StorefrontData;
  ctx: RenderContext;
  customer: CustomerSession | null;
}

/** The store, its rules, and whoever is signed in. For /login, /signup, /verify. */
export async function loadAuthPage(slug: string, next?: string): Promise<AuthPageData> {
  const store = await loadStorefront(slug);
  if (!store) notFound();

  const customer = await getCustomer(store.tenantId);
  const account = await accountContextFor(store, customer, next ? safeNext(next) : null);
  return { store, ctx: renderContextFor(store, { account }), customer };
}

export interface AccountPageData {
  store: StorefrontData;
  ctx: RenderContext;
  customer: CustomerSession;
}

/**
 * The same, but signed in or somewhere else.
 *
 * Redirects to the SHOP's own sign-in page, never BuilderHut's — a customer of a
 * bakery has no business being shown a merchant login.
 */
export async function loadAccountPage(
  slug: string,
  path: string,
  opts?: { summary?: boolean; recentOrders?: number },
): Promise<AccountPageData> {
  const store = await loadStorefront(slug);
  if (!store) notFound();

  const customer = await getCustomer(store.tenantId);
  if (!customer) {
    redirect(`/s/${slug}/login?next=${encodeURIComponent(safeNext(path))}`);
  }

  const summary = opts?.summary
    ? await loadAccountSummary(store, customer.customerId, opts.recentOrders ?? 3)
    : undefined;
  const account = await accountContextFor(store, customer, null, summary);
  return { store, ctx: renderContextFor(store, { account }), customer };
}

/** Everything the account landing page shows, in one transaction. */
export async function loadAccountSummary(
  store: StorefrontData,
  customerId: string,
  recentOrders: number,
): Promise<AccountSummary> {
  return withTenant(
    { tenantId: store.tenantId, actorId: store.tenantId, role: "staff" },
    async (db): Promise<AccountSummary> => {
      const rows = await db
        .select(orders)
        .where(eq(orders.customerId, customerId))
        .orderBy(desc(orders.createdAt))
        .limit(Math.max(1, recentOrders));

      /*
       * One query for all the line counts rather than one per order — the same
       * shape loadStorefrontProducts() uses for product images, and for the same
       * reason: a list of ten orders should not be eleven round trips.
       */
      const lines = rows.length ? await db.select(orderItems) : [];
      const countFor = new Map<string, number>();
      for (const line of lines) {
        countFor.set(line.orderId, (countFor.get(line.orderId) ?? 0) + line.quantity);
      }

      const addresses = await db
        .select(customerAddresses)
        .where(eq(customerAddresses.customerId, customerId));
      const preferred = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;

      const saved = await db
        .select(wishlistItems)
        .where(eq(wishlistItems.customerId, customerId))
        .orderBy(desc(wishlistItems.createdAt));

      let wishlist: ProductCard[] = [];
      if (saved.length > 0) {
        const catalogue = await db
          .select(products)
          .where(and(isNull(products.deletedAt), eq(products.status, "active")));
        const byId = new Map(catalogue.map((p) => [p.id, p]));
        const images = await db.select(productImages).orderBy(productImages.position);
        const firstImage = new Map<string, string>();
        for (const image of images) {
          if (!firstImage.has(image.productId)) {
            firstImage.set(image.productId, imageUrlFor(image.mediaKey));
          }
        }
        wishlist = saved
          .map((item) => byId.get(item.productId))
          .filter((product): product is NonNullable<typeof product> => product !== undefined)
          .map((product) => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            priceMinor: product.priceMinor,
            compareAtMinor: product.compareAtMinor,
            currency: product.currency || store.currency,
            imageUrl: firstImage.get(product.id) ?? null,
            soldOut: product.trackStock ? product.stock <= 0 : false,
          }));
      }

      return {
        orders: rows.map(
          (order): AccountOrderCard => ({
            id: order.id,
            number: order.number,
            status: order.status,
            placedAt: order.placedAt,
            paidAt: order.paidAt,
            shippedAt: order.shippedAt,
            deliveredAt: order.deliveredAt,
            cancelledAt: order.cancelledAt,
            totalMinor: Number(order.totalMinor),
            currency: order.currency,
            itemCount: countFor.get(order.id) ?? 0,
          }),
        ),
        addressCount: addresses.length,
        defaultAddressLines: preferred
          ? [
              preferred.name,
              preferred.line1,
              preferred.line2,
              [preferred.city, preferred.region, preferred.postalCode].filter(Boolean).join(" "),
            ].filter((line): line is string => Boolean(line))
          : null,
        wishlist,
      };
    },
  );
}
