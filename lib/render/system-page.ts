import { defaultPropsFor, type RegistryEntry } from "./registry";
import { REGISTRY } from "./registry";
import type { Page, Section, SectionType, SiteDocument, SystemPage } from "@/lib/schema/page";
import { systemPage } from "@/lib/schema/page";

/*
 * What to render for a system route.
 *
 * A document that has the page wins. A document that does not — every store
 * published before customer accounts shipped — gets the section on its own,
 * between the home page's header and footer. That is exactly how /cart and
 * /checkout have always worked, with the body coming from the registry instead of
 * a bespoke component.
 *
 * The point of the fallback is that nothing has to be republished for sign-in to
 * start working, and nobody's live shop changes on the day this deploys.
 */

export type SystemPageRender =
  | { kind: "document"; page: Page }
  | { kind: "fallback"; section: Section };

/** A synthetic section, with the registry's own defaults for its props. */
function syntheticSection(type: SectionType): Section {
  return {
    id: `fallback-${type}`,
    type,
    // Straight from the schema, so the default copy has one source rather than a
    // second one here that drifts from it.
    props: defaultPropsFor(type),
    visible: true,
    locked: true,
  };
}

export function resolveSystemPage(
  doc: SiteDocument,
  system: SystemPage,
  fallbackType: SectionType,
): SystemPageRender {
  const page = systemPage(doc, system);
  /*
   * A page whose section the merchant removed falls back too. It can only happen
   * by way of an older document or an edit the guards did not cover, and a
   * sign-in page with no sign-in form is a dead end — better the plain form than
   * a heading and nothing under it.
   */
  if (page?.sections.some((section) => section.type === fallbackType)) {
    return { kind: "document", page };
  }
  return { kind: "fallback", section: syntheticSection(fallbackType) };
}

/** The entry for a section type, for callers that need its label or rules. */
export function entryFor(type: SectionType): RegistryEntry {
  return REGISTRY[type];
}
