"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import {
  continueWithPassword,
  requestPasswordReset,
  resetPassword,
  sendCode,
  setPassword,
  verifyCode,
  type AuthResult,
} from "@/lib/customers/auth";
import {
  clearSessionCookie,
  getCustomer,
  logoutCustomer,
  requestFingerprint,
  writeSessionCookie,
} from "@/lib/customers/session";
import { readCartToken, writeCartToken } from "@/lib/commerce/cart";
import { customerAddresses, customers, wishlistItems } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { loadPublishedSite } from "@/lib/stores/storefront";
import { safeNext } from "@/lib/storefront/account";

/*
 * Customer account actions.
 *
 * Same rule as the rest of the storefront actions: the slug in the URL is the
 * authorization, resolved here rather than trusted from a form. Nothing reads a
 * tenant id or a customer id out of FormData — a customer id from a browser is a
 * request to be somebody else.
 *
 * Cookies are written HERE, after the service call has closed its transaction.
 * They cannot be written during a render, and holding the single pooled
 * connection open across an SMS provider's network call is how a shop stops
 * responding.
 */

async function resolveStore(slug: string) {
  const site = await loadPublishedSite(slug);
  if (!site) redirect("/");
  return site;
}

export type AuthState = {
  error?: string;
  field?: string;
  /** Set when a code is in flight: the verify screen needs to know for whom. */
  code?: { identifier: string; channel: "email" | "sms"; sentTo: string };
  /**
   * When this result was produced.
   *
   * The verify screen keys its boxes and its resend countdown off this, so "a new
   * answer arrived" is something the state SAYS rather than something the client
   * infers by comparing object identity across renders — which the React compiler
   * rules rightly refuse to let a component do.
   */
  at?: number;
};

/** Every returned state is stamped, so the client can tell one from the next. */
function fresh(state: Omit<AuthState, "at">): AuthState {
  return { ...state, at: Date.now() };
}

/**
 * Put a session in the browser and repoint the cart cookie if the basket moved.
 *
 * getCart() finds a cart by its token and by nothing else, so a customer cart
 * adopted at sign-in is invisible until the cookie points at it — the row is
 * right there and the basket looks empty.
 */
async function land(tenantId: string, result: Extract<AuthResult, { next: "signed_in" }>) {
  await writeSessionCookie(tenantId, result.token);
  if (result.cartToken) await writeCartToken(tenantId, result.cartToken);
}

export async function signInAction(
  slug: string,
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const site = await resolveStore(slug);
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || null);

  const result = await continueWithPassword({
    tenantId: site.tenantId,
    shopName: site.storeName,
    identifier,
    password,
    request: await requestFingerprint(),
    cartToken: await readCartToken(site.tenantId),
  });

  if (!result.ok) return fresh({ error: result.message, field: result.field });
  if (result.next === "code") {
    return fresh({
      code: { identifier: result.identifier, channel: result.channel, sentTo: result.sentTo },
    });
  }

  await land(site.tenantId, result);
  /*
   * redirect(), not revalidatePath(). Revalidating a layout from an action
   * running on a page inside it aborts the response stream — the lesson written
   * up in addToCartAction — and a sign-in is leaving this page anyway.
   */
  redirect(`/s/${slug}${next === "/" ? "" : next}`);
}

export async function signUpAction(
  slug: string,
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const site = await resolveStore(slug);
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  const next = safeNext(String(formData.get("next") ?? "") || null);

  const result = await continueWithPassword({
    tenantId: site.tenantId,
    shopName: site.storeName,
    identifier,
    password,
    name,
    acceptsMarketing: formData.get("acceptsMarketing") === "on",
    request: await requestFingerprint(),
    cartToken: await readCartToken(site.tenantId),
  });

  if (!result.ok) return fresh({ error: result.message, field: result.field });
  if (result.next === "code") {
    return fresh({
      code: { identifier: result.identifier, channel: result.channel, sentTo: result.sentTo },
    });
  }

  await land(site.tenantId, result);
  redirect(`/s/${slug}${next === "/" ? "" : next}`);
}

/** "Send me a code instead", and the resend on the verify screen. */
export async function sendCodeAction(
  slug: string,
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const site = await resolveStore(slug);
  const result = await sendCode({
    tenantId: site.tenantId,
    shopName: site.storeName,
    identifier: String(formData.get("identifier") ?? ""),
    request: await requestFingerprint(),
  });

  if (!result.ok) return fresh({ error: result.message, field: result.field });
  return fresh({ code: { identifier: result.identifier, channel: result.channel, sentTo: result.sentTo } });
}

export async function verifyCodeAction(
  slug: string,
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const site = await resolveStore(slug);
  const next = safeNext(String(formData.get("next") ?? "") || null);

  /*
   * The hidden field when the client bundle is running, the six boxes when it is
   * not. Reading both means the screen works either way — and it means a mistake
   * in the client's ordering cannot silently submit an empty code, which is
   * exactly what it did once.
   */
  const typed = String(formData.get("code") ?? "").trim();
  const code = typed || formData.getAll("digit").map(String).join("").trim();

  const result = await verifyCode({
    tenantId: site.tenantId,
    identifier: String(formData.get("identifier") ?? ""),
    code,
    name: String(formData.get("name") ?? "") || undefined,
    request: await requestFingerprint(),
    cartToken: await readCartToken(site.tenantId),
  });

  if (!result.ok) return fresh({ error: result.message, field: result.field });
  await land(site.tenantId, result);
  redirect(`/s/${slug}${next === "/" ? "" : next}`);
}

export async function forgotPasswordAction(
  slug: string,
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const site = await resolveStore(slug);
  const result = await requestPasswordReset({
    tenantId: site.tenantId,
    shopName: site.storeName,
    identifier: String(formData.get("identifier") ?? ""),
    request: await requestFingerprint(),
  });
  if (!result.ok) return fresh({ error: result.message, field: result.field });
  return fresh({ code: { identifier: result.identifier, channel: result.channel, sentTo: result.sentTo } });
}

export async function resetPasswordAction(
  slug: string,
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const site = await resolveStore(slug);
  const result = await resetPassword({
    tenantId: site.tenantId,
    identifier: String(formData.get("identifier") ?? ""),
    code: String(formData.get("code") ?? ""),
    password: String(formData.get("password") ?? ""),
    request: await requestFingerprint(),
    cartToken: await readCartToken(site.tenantId),
  });
  if (!result.ok) return fresh({ error: result.message, field: result.field });
  await land(site.tenantId, result);
  redirect(`/s/${slug}/account`);
}

export async function signOutAction(slug: string): Promise<void> {
  const site = await resolveStore(slug);
  await logoutCustomer(site.tenantId);
  redirect(`/s/${slug}`);
}

/* ── inside the account area ─────────────────────────────────────────────── */

export type ProfileState = { ok?: boolean; error?: string; field?: string };

export async function saveProfileAction(
  slug: string,
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const site = await resolveStore(slug);
  const customer = await getCustomer(site.tenantId);
  if (!customer) return { error: "Please sign in again." };

  const name = String(formData.get("name") ?? "").trim();
  if (name.length > 120) return { error: "That name is too long.", field: "name" };

  await withTenant(
    { tenantId: site.tenantId, actorId: site.tenantId, role: "staff" },
    (db) =>
      db.update(
        customers,
        { name: name || null, acceptsMarketing: formData.get("acceptsMarketing") === "on" },
        eq(customers.id, customer.customerId),
      ),
  );
  revalidatePath(`/s/${slug}/account/profile`);
  return { ok: true };
}

export async function changePasswordAction(
  slug: string,
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const site = await resolveStore(slug);
  const customer = await getCustomer(site.tenantId);
  if (!customer) return { error: "Please sign in again." };

  const result = await setPassword({
    tenantId: site.tenantId,
    customerId: customer.customerId,
    sessionId: customer.sessionId,
    current: String(formData.get("current") ?? "") || undefined,
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) return { error: result.message, field: result.field };
  return { ok: true };
}

export type AddressState = { ok?: boolean; error?: string; field?: string };

export async function saveAddressAction(
  slug: string,
  _previous: AddressState,
  formData: FormData,
): Promise<AddressState> {
  const site = await resolveStore(slug);
  const customer = await getCustomer(site.tenantId);
  if (!customer) return { error: "Please sign in again." };

  const values = {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    line1: String(formData.get("line1") ?? "").trim(),
    line2: String(formData.get("line2") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim(),
    region: String(formData.get("region") ?? "").trim() || null,
    postalCode: String(formData.get("postalCode") ?? "").trim() || null,
    country: (String(formData.get("country") ?? "IN").trim() || "IN").toUpperCase().slice(0, 2),
  };
  if (values.name.length < 2) return { error: "We need a name for the parcel.", field: "name" };
  if (values.line1.length < 3) return { error: "We need a street address.", field: "line1" };
  if (values.city.length < 2) return { error: "We need a town or city.", field: "city" };

  // An id from the browser is checked against the signed-in customer, never
  // trusted: the tenant scope stops it being another shop's, and this stops it
  // being another customer's.
  const addressId = String(formData.get("addressId") ?? "").trim() || null;

  const result = await withTenant(
    { tenantId: site.tenantId, actorId: site.tenantId, role: "staff" },
    async (db): Promise<AddressState> => {
      if (addressId) {
        const [existing] = await db
          .select(customerAddresses)
          .where(eq(customerAddresses.id, addressId))
          .limit(1);
        if (!existing || existing.customerId !== customer.customerId) {
          return { error: "That address is no longer there." };
        }
        await db.update(customerAddresses, values, eq(customerAddresses.id, addressId));
        return { ok: true };
      }

      const held = await db
        .select(customerAddresses)
        .where(eq(customerAddresses.customerId, customer.customerId));
      if (held.length >= 10) {
        return { error: "That's as many addresses as we can keep for you." };
      }
      await db.insert(customerAddresses, {
        ...values,
        customerId: customer.customerId,
        // The first one is the default, because a single address that is not the
        // default is a checkout that prefills nothing.
        isDefault: held.length === 0,
      });
      return { ok: true };
    },
  );

  if (result.ok) revalidatePath(`/s/${slug}/account/addresses`);
  return result;
}

export async function deleteAddressAction(slug: string, addressId: string): Promise<AddressState> {
  const site = await resolveStore(slug);
  const customer = await getCustomer(site.tenantId);
  if (!customer) return { error: "Please sign in again." };

  await withTenant(
    { tenantId: site.tenantId, actorId: site.tenantId, role: "staff" },
    async (db) => {
      const [existing] = await db
        .select(customerAddresses)
        .where(eq(customerAddresses.id, addressId))
        .limit(1);
      if (!existing || existing.customerId !== customer.customerId) return;
      await db.delete(customerAddresses, eq(customerAddresses.id, addressId));

      // Something has to be the default, or the checkout prefills nothing.
      if (existing.isDefault) {
        const [next] = await db
          .select(customerAddresses)
          .where(eq(customerAddresses.customerId, customer.customerId))
          .limit(1);
        if (next) {
          await db.update(customerAddresses, { isDefault: true }, eq(customerAddresses.id, next.id));
        }
      }
    },
  );
  revalidatePath(`/s/${slug}/account/addresses`);
  return { ok: true };
}

export async function makeDefaultAddressAction(
  slug: string,
  addressId: string,
): Promise<AddressState> {
  const site = await resolveStore(slug);
  const customer = await getCustomer(site.tenantId);
  if (!customer) return { error: "Please sign in again." };

  await withTenant(
    { tenantId: site.tenantId, actorId: site.tenantId, role: "staff" },
    async (db) => {
      const held = await db
        .select(customerAddresses)
        .where(eq(customerAddresses.customerId, customer.customerId));
      if (!held.some((address) => address.id === addressId)) return;
      for (const address of held) {
        const shouldBe = address.id === addressId;
        if (address.isDefault !== shouldBe) {
          await db.update(
            customerAddresses,
            { isDefault: shouldBe },
            eq(customerAddresses.id, address.id),
          );
        }
      }
    },
  );
  revalidatePath(`/s/${slug}/account/addresses`);
  return { ok: true };
}

export type WishlistState = { saved: boolean; error?: string };

/** Save or unsave a product. Signed-in only: wishlist_items.customer_id is NOT NULL. */
export async function toggleWishlistAction(
  slug: string,
  productId: string,
): Promise<WishlistState> {
  const site = await resolveStore(slug);
  const customer = await getCustomer(site.tenantId);
  if (!customer) return { saved: false, error: "Please sign in to save things." };

  const saved = await withTenant(
    { tenantId: site.tenantId, actorId: site.tenantId, role: "staff" },
    async (db) => {
      // Scoped to this customer as well as this store: another customer of the
      // same shop having saved it is not this customer having saved it.
      const [existing] = await db
        .select(wishlistItems)
        .where(
          and(
            eq(wishlistItems.customerId, customer.customerId),
            eq(wishlistItems.productId, productId),
          ),
        )
        .limit(1);
      if (existing) {
        await db.delete(wishlistItems, eq(wishlistItems.id, existing.id));
        return false;
      }
      await db.insert(wishlistItems, { customerId: customer.customerId, productId });
      return true;
    },
  );

  revalidatePath(`/s/${slug}/account/wishlist`);
  return { saved };
}

/** Sweep a stale cookie when the session behind it has gone. */
export async function clearStaleSessionAction(slug: string): Promise<void> {
  const site = await resolveStore(slug);
  await clearSessionCookie(site.tenantId);
}
