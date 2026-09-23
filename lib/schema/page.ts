import { z } from "zod";
import { ThemeSchema } from "./theme";

/*
 * The document the builder edits and the storefront renders.
 *
 * Blueprint section 63 states the rule this file exists to enforce: generated
 * HTML is never the canonical source. What is stored is structure — sections,
 * their type, their props, their responsive overrides — and the same structure
 * renders into the editor canvas and the live page.
 *
 * That is what makes versioning, templates, AI edits, validation and responsive
 * behaviour tractable. An HTML blob would make all five miserable.
 *
 * Bump SCHEMA_VERSION when the shape changes incompatibly; published versions
 * record the version they were written with, so an old snapshot stays readable.
 */

export const SCHEMA_VERSION = 1;

/**
 * Every section type the renderer knows, and the only values accepted from a
 * browser. An unregistered type is rejected at validation and never rendered —
 * blueprint section 34 is explicit, and a component name from a request is a
 * direct line into the render tree.
 */
export const SECTION_TYPES = [
  "header",
  "hero",
  "productGrid",
  "featureList",
  "richText",
  "imageBanner",
  "gallery",
  "testimonials",
  "faq",
  "newsletter",
  "contact",
  "footer",
] as const;

export const SectionTypeSchema = z.enum(SECTION_TYPES);
export type SectionType = (typeof SECTION_TYPES)[number];

/*
 * Props are validated per section type by the registry, not here. This schema
 * keeps them as an open record so the document can be parsed structurally
 * before the registry narrows each section — which is what lets an unknown
 * section be reported by name rather than failing the whole page.
 */
const PropsSchema = z.record(z.string(), z.unknown());

/** Overrides applied at a breakpoint. Absent means "inherit desktop". */
const ResponsiveSchema = z
  .object({
    tablet: PropsSchema.optional(),
    mobile: PropsSchema.optional(),
  })
  .optional();

export const SectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: SectionTypeSchema,
  props: PropsSchema,
  responsive: ResponsiveSchema,
  /** Hidden sections stay in the document so hiding is reversible. */
  visible: z.boolean().default(true),
  /** Locked sections resist accidental drag. A convenience, never a permission. */
  locked: z.boolean().default(false),
});

export type Section = z.infer<typeof SectionSchema>;

export const SeoSchema = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(200).optional(),
  image: z.string().max(400).optional(),
  noindex: z.boolean().default(false),
});

/**
 * System pages cannot be deleted or have their slug changed: the storefront
 * routes to them by name, and a checkout that 404s is not a recoverable state.
 */
export const SYSTEM_PAGES = ["home", "shop", "product", "cart", "checkout", "account"] as const;

export const PageSchema = z.object({
  id: z.string().min(1).max(64),
  /** "" is the homepage. Otherwise a path segment. */
  slug: z.string().max(80),
  title: z.string().min(1).max(120),
  system: z.enum(SYSTEM_PAGES).optional(),
  hidden: z.boolean().default(false),
  seo: SeoSchema.default({ noindex: false }),
  sections: z.array(SectionSchema).max(60),
});

export type Page = z.infer<typeof PageSchema>;

export const NavItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(40),
  /** Internal path or absolute URL. Validated at render, never interpolated raw. */
  href: z.string().max(400),
});

export const SiteDocumentSchema = z.object({
  schemaVersion: z.number().int().positive(),
  templateId: z.string().min(1).max(40),
  theme: ThemeSchema,
  nav: z.array(NavItemSchema).max(12),
  footerNav: z.array(NavItemSchema).max(12),
  pages: z.array(PageSchema).min(1).max(40),
  settings: z.object({
    storeName: z.string().min(1).max(80),
    tagline: z.string().max(140).default(""),
    logoUrl: z.string().max(400).nullable().default(null),
    socials: z
      .object({
        instagram: z.string().max(200).default(""),
        whatsapp: z.string().max(40).default(""),
        email: z.string().max(200).default(""),
        phone: z.string().max(40).default(""),
      })
      .default({ instagram: "", whatsapp: "", email: "", phone: "" }),
  }),
});

export type SiteDocument = z.infer<typeof SiteDocumentSchema>;

/** Only http(s), mailto and tel reach an href. Everything else — javascript:, data: — is dropped. */
export function safeHref(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "#";
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : "#";
  } catch {
    return "#";
  }
}

export function findPage(doc: SiteDocument, slug: string): Page | undefined {
  const wanted = slug.replace(/^\/+|\/+$/g, "");
  return doc.pages.find((p) => p.slug.replace(/^\/+|\/+$/g, "") === wanted);
}

export function homePage(doc: SiteDocument): Page {
  // A document with no home page cannot render; the schema requires at least
  // one page, so falling back to the first is always defined.
  return doc.pages.find((p) => p.system === "home") ?? doc.pages[0]!;
}
