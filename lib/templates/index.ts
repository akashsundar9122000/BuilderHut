import { SiteDocumentSchema, type SiteDocument } from "@/lib/schema/page";
import { TEMPLATES } from "./definitions";
import type { Template, TemplateSeed } from "./types";

export type { Template, TemplateSeed } from "./types";
export { TEMPLATES } from "./definitions";

export function getTemplateIds(): string[] {
  return TEMPLATES.map((t) => t.id);
}

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Templates designed for a trade, best fit first, never an empty list. */
export function templatesForIndustry(industry: string): Template[] {
  const matching = TEMPLATES.filter((t) => t.industries.includes(industry));
  const rest = TEMPLATES.filter((t) => !t.industries.includes(industry));
  return [...matching, ...rest];
}

/**
 * Build a template's starting document, validated.
 *
 * Parsing here rather than trusting the definition means a template with a
 * malformed section fails at the point it is written, not when a merchant's
 * storefront tries to render it.
 */
export function buildDocument(templateId: string, seed: TemplateSeed): SiteDocument {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);
  return SiteDocumentSchema.parse(template.build(seed));
}
