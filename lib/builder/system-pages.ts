import { accountPages } from "@/lib/templates/helpers";
import {
  SYSTEM_PAGES,
  type Page,
  type Section,
  type SiteDocument,
  type SystemPage,
} from "@/lib/schema/page";

/*
 * Bringing an existing document up to date with the system pages it is missing.
 *
 * Every store published before customer accounts shipped has no login, signup or
 * account page in its document. The storefront routes cope — they fall back to
 * rendering the section on its own — but a merchant cannot lay out a page that is
 * not there, so the draft gets them added the next time they open the builder.
 *
 * Pure and idempotent, so it can be unit-tested without a database and called
 * more than once without piling up pages.
 */

export interface BackfillResult {
  doc: SiteDocument;
  /** Pages appended. */
  added: SystemPage[];
  /** Pages the merchant had already made at that slug, now adopted. */
  adopted: SystemPage[];
  /** Pages there was no room for. The route's fallback serves these. */
  skipped: SystemPage[];
}

/** The document schema's own ceiling. Going past it makes every save fail. */
const MAX_PAGES = 40;

const ACCOUNT_SYSTEM_PAGES = ["login", "signup", "account"] as const;

function sectionTypeFor(system: (typeof ACCOUNT_SYSTEM_PAGES)[number]): Section["type"] {
  switch (system) {
    case "login":
      return "accountLogin";
    case "signup":
      return "accountSignup";
    case "account":
      return "accountArea";
  }
}

/** Put the section above the footer, so the chrome still closes the page. */
function withSection(page: Page, section: Section): Page {
  const footerAt = page.sections.findIndex((s) => s.type === "footer");
  const sections = [...page.sections];
  if (footerAt === -1) sections.push(section);
  else sections.splice(footerAt, 0, section);
  return { ...page, sections };
}

export function withAccountPages(doc: SiteDocument): BackfillResult {
  const seeded = new Map(accountPages().map((page) => [page.system as SystemPage, page]));
  const added: SystemPage[] = [];
  const adopted: SystemPage[] = [];
  const skipped: SystemPage[] = [];

  const pages = [...doc.pages];

  for (const system of ACCOUNT_SYSTEM_PAGES) {
    if (!SYSTEM_PAGES.includes(system)) continue;

    // Already there by role: leave every word of it alone.
    if (pages.some((page) => page.system === system)) continue;

    const template = seeded.get(system);
    if (!template) continue;
    const sectionType = sectionTypeFor(system);

    /*
     * A merchant may already have written their own page at this slug. Adopt it
     * — set its system role and insert the form above its footer — rather than
     * appending a second page the static route would shadow, leaving their work
     * unreachable with no error anywhere to explain why.
     */
    const existingAt = pages.findIndex(
      (page) => !page.system && page.slug.replace(/^\/+|\/+$/g, "") === system,
    );
    if (existingAt !== -1) {
      const theirs = pages[existingAt]!;
      const section = template.sections.find((s) => s.type === sectionType)!;
      pages[existingAt] = withSection({ ...theirs, system }, section);
      adopted.push(system);
      continue;
    }

    /*
     * Refuse rather than overflow.
     *
     * A 41-page document fails SiteDocumentSchema, which makes every subsequent
     * saveDraft reject — silently, while the merchant keeps typing. The route's
     * fallback still gives them a working sign-in page, which is a far better
     * outcome than a builder that has quietly stopped saving.
     */
    if (pages.length >= MAX_PAGES) {
      skipped.push(system);
      continue;
    }

    pages.push(template);
    added.push(system);
  }

  if (added.length === 0 && adopted.length === 0) {
    return { doc, added, adopted, skipped };
  }
  return { doc: { ...doc, pages }, added, adopted, skipped };
}
