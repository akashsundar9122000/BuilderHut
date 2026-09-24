import type { NavItemSchema, Page } from "@/lib/schema/page";
import type { z } from "zod";

/*
 * Every template builds its document from these, so a section id is predictable
 * ("hero-1") rather than random. Predictable ids make a template's document
 * diffable between versions, which is what makes "what changed since I
 * published" answerable later.
 */

let counter = 0;
export function sid(type: string): string {
  counter += 1;
  return `${type}-${counter}`;
}

export type NavItem = z.infer<typeof NavItemSchema>;

export function nav(items: [label: string, href: string][]): NavItem[] {
  return items.map(([label, href], i) => ({ id: `nav-${i + 1}`, label, href }));
}

/** The pages every store starts with. Policies are stubs the merchant edits. */
export const POLICY_PAGES = [
  { slug: "shipping-policy", title: "Shipping" },
  { slug: "refund-policy", title: "Returns & refunds" },
  { slug: "privacy-policy", title: "Privacy" },
  { slug: "terms", title: "Terms" },
] as const;

/*
 * The customer-account pages, in the one shape everything creates them in.
 *
 * Used by every template for a new store AND by the back-fill in
 * lib/builder/system-pages.ts for an existing one, so a seeded page and a
 * back-filled page are the same page — otherwise "add a hero above the sign-in
 * form" would work differently depending on when the shop was made.
 *
 * noindex, because a sign-in page has no business in a search index; hidden:
 * false, because the merchant should see them in their page list.
 */
export function accountPages(): Page[] {
  return [
    accountPage("login", "login", "Sign in", "accountLogin", "login-form"),
    accountPage("signup", "signup", "Create account", "accountSignup", "signup-form"),
    accountPage("account", "account", "Your account", "accountArea", "account-area"),
  ];
}

function accountPage(
  id: string,
  slug: string,
  title: string,
  section: "accountLogin" | "accountSignup" | "accountArea",
  sectionId: string,
): Page {
  return {
    id,
    slug,
    title,
    system: slug as Page["system"],
    hidden: false,
    seo: { noindex: true },
    sections: [
      // Header first and footer last, on every page — tests/unit/templates.test.ts
      // asserts it, and the chrome would look wrong otherwise.
      { id: `${id}-header`, type: "header", props: {}, visible: true, locked: true },
      { id: sectionId, type: section, props: {}, visible: true, locked: false },
      { id: `${id}-footer`, type: "footer", props: {}, visible: true, locked: true },
    ],
  };
}
