import type { NavItemSchema } from "@/lib/schema/page";
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
