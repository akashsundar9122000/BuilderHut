import type { SiteDocument } from "@/lib/schema/page";

/** A product as a storefront section needs it — never the whole database row. */
export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  priceMinor: bigint | number;
  compareAtMinor: bigint | number | null;
  currency: string;
  imageUrl: string | null;
  soldOut?: boolean;
}

/** The store's sign-in rules, as much of them as a section needs to draw a form. */
export interface AccountPolicyView {
  identifier: "email_only" | "phone_only" | "either" | "both";
  credential: "password" | "code" | "both";
  verification: "at_signup" | "before_checkout" | "off";
  /** tenants.country, so a mobile number field starts in the right place. */
  defaultCountry: string;
}

/** Who is signed in. Never the password hash, never anything not on screen. */
export interface SignedInCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface AccountOrderCard {
  id: string;
  number: number;
  status: string;
  placedAt: Date | null;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  totalMinor: number;
  currency: string;
  itemCount: number;
}

/** Filled by the /account route only, for the accountArea section. */
export interface AccountSummary {
  orders: AccountOrderCard[];
  addressCount: number;
  defaultAddressLines: string[] | null;
  wishlist: ProductCard[];
}

/**
 * What the customer-account routes hand to the sections that need it.
 *
 * Its ABSENCE is the signal that this is the builder canvas or the draft
 * preview, where the auth sections draw an inert sample instead of a working
 * form. That is why it is optional rather than always present: neither of those
 * has a session, and neither has a store slug to bind a server action to.
 */
export interface AccountContext {
  /**
   * The store slug, for binding server actions.
   *
   * Never derived from ctx.base: in the preview that is "/app/builder/preview",
   * and a form that pulled a slug out of it would be posting a real sign-in
   * attempt at a shop that does not exist.
   */
  slug: string;
  policy: AccountPolicyView;
  /** Null when nobody is signed in. */
  customer: SignedInCustomer | null;
  /** Where to go after signing in. Already checked to be inside this store. */
  next: string | null;
  summary?: AccountSummary;
}

/**
 * Everything a section may read. Passed down rather than fetched per section,
 * so one page render is one set of queries instead of N.
 */
export interface RenderContext {
  doc: SiteDocument;
  /** Base path for internal links: "/s/thread-bloom" or "" on a custom domain. */
  base: string;
  products: ProductCard[];
  /** True inside the builder canvas: suppresses navigation and real form posts. */
  editing: boolean;
  /**
   * Present only on the customer-account routes, which are the only ones that
   * open a customer session. Absent everywhere else — including the preview, so
   * the auth sections there render as a sample rather than as a live form.
   */
  account?: AccountContext;
}

export function linkTo(ctx: RenderContext, path: string): string {
  if (/^https?:|^mailto:|^tel:/.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${ctx.base}${clean === "/" ? "" : clean}` || "/";
}
