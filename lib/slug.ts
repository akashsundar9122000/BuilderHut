/*
 * Store addresses.
 *
 * A slug becomes a public URL and, once a domain exists, a subdomain. It is the
 * one identifier a merchant will read aloud down a phone, so it is lowercase,
 * hyphenated and short.
 *
 * Two lists guard it, and they exist for different reasons. RESERVED protects
 * the platform's own routes — a store at /login would shadow the login page.
 * BLOCKED protects third parties: a store at /paypal or /hdfc is a phishing
 * site wearing our domain, and we are the ones who would be hosting it.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

const SHAPE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Every top-level route this app serves, plus room to add more. */
const RESERVED = new Set([
  "api", "app", "admin", "s", "store", "stores", "media", "dev", "_next",
  "login", "signup", "signin", "signout", "logout", "verify", "onboarding",
  "forgot", "reset", "account", "settings", "billing", "pricing", "features",
  "templates", "template", "docs", "help", "support", "status", "blog", "about",
  "contact", "legal", "privacy", "terms", "security", "abuse", "report",
  "builderhut", "www", "mail", "ftp", "cdn", "assets", "static", "public",
  "preview", "draft", "new", "edit", "search", "cart", "checkout", "order",
]);

/*
 * Brands whose name on our domain would make a convincing phishing page. Not
 * exhaustive and cannot be — it is a speed bump, backed by the abuse reporting
 * and take-down flow, not a substitute for it.
 */
const BLOCKED = new Set([
  "paypal", "stripe", "razorpay", "paytm", "phonepe", "gpay", "googlepay", "upi",
  "visa", "mastercard", "amex", "rupay",
  "hdfc", "icici", "sbi", "axis", "kotak", "rbi", "paypalindia",
  "google", "gmail", "apple", "icloud", "microsoft", "outlook", "amazon", "flipkart",
  "meta", "facebook", "instagram", "whatsapp", "youtube", "netflix", "shopify",
  "aadhaar", "aadhar", "pan", "gst", "incometax", "irctc", "india", "gov",
]);

export type SlugProblem =
  | { ok: true }
  | { ok: false; reason: string };

/** Best-effort slug from a business name. The merchant can always override it. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

export function checkSlug(slug: string): SlugProblem {
  if (slug.length < SLUG_MIN) {
    return { ok: false, reason: `Store addresses need at least ${SLUG_MIN} characters.` };
  }
  if (slug.length > SLUG_MAX) {
    return { ok: false, reason: `Store addresses can be at most ${SLUG_MAX} characters.` };
  }
  if (!SHAPE.test(slug)) {
    return {
      ok: false,
      reason: "Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.",
    };
  }
  if (slug.includes("--")) {
    return { ok: false, reason: "Two hyphens in a row is a bit much." };
  }
  if (RESERVED.has(slug)) {
    return { ok: false, reason: "That address is reserved by BuilderHut. Try another." };
  }
  if (BLOCKED.has(slug)) {
    return { ok: false, reason: "That address is too close to a well-known brand." };
  }
  return { ok: true };
}
