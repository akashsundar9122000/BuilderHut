import type { z } from "zod";

import type { SectionType } from "@/lib/schema/page";
import type { RenderContext } from "./context";
import { Footer, FooterProps, Header, HeaderProps } from "./sections/structure";
import {
  FeatureList,
  FeatureListProps,
  Gallery,
  GalleryProps,
  Hero,
  HeroProps,
  ImageBanner,
  ImageBannerProps,
  RichText,
  RichTextProps,
} from "./sections/content";
import { ProductGrid, ProductGridProps } from "./sections/commerce";
import {
  Contact,
  ContactProps,
  Faq,
  FaqProps,
  Newsletter,
  NewsletterProps,
  Testimonials,
  TestimonialsProps,
} from "./sections/engage";

/*
 * The component registry.
 *
 * One map from a section type to the component that draws it and the schema
 * that validates its props. Three callers share it — the builder canvas, the
 * live storefront, and the preview — which is what makes the editor genuinely
 * WYSIWYG rather than an approximation that drifts.
 *
 * Blueprint section 34: a type name arriving from a browser is a key into this
 * map. Anything not in it is rejected, never rendered.
 */

export interface RegistryEntry {
  /** Shown in the builder's Add panel and the layer tree. */
  label: string;
  /** Grouping in the Add panel. */
  group: "structure" | "content" | "commerce" | "engage";
  schema: z.ZodType;
  component: (args: { props: never; ctx: RenderContext }) => React.ReactNode;
  /** Structural sections cannot be deleted or reordered out of place. */
  fixed?: "top" | "bottom";
  /** A one-line description for the Add panel. */
  hint: string;
}

export const REGISTRY: Record<SectionType, RegistryEntry> = {
  header: {
    label: "Header",
    group: "structure",
    schema: HeaderProps,
    component: Header as RegistryEntry["component"],
    fixed: "top",
    hint: "Logo, navigation, search and cart",
  },
  hero: {
    label: "Hero",
    group: "content",
    schema: HeroProps,
    component: Hero as RegistryEntry["component"],
    hint: "The first thing a visitor sees",
  },
  productGrid: {
    label: "Product grid",
    group: "commerce",
    schema: ProductGridProps,
    component: ProductGrid as RegistryEntry["component"],
    hint: "A row or grid of what you sell",
  },
  featureList: {
    label: "Highlights",
    group: "content",
    schema: FeatureListProps,
    component: FeatureList as RegistryEntry["component"],
    hint: "Two to four short selling points",
  },
  richText: {
    label: "Text",
    group: "content",
    schema: RichTextProps,
    component: RichText as RegistryEntry["component"],
    hint: "Your story, in your own words",
  },
  imageBanner: {
    label: "Image and text",
    group: "content",
    schema: ImageBannerProps,
    component: ImageBanner as RegistryEntry["component"],
    hint: "A picture beside a paragraph",
  },
  gallery: {
    label: "Gallery",
    group: "content",
    schema: GalleryProps,
    component: Gallery as RegistryEntry["component"],
    hint: "A grid of photographs",
  },
  testimonials: {
    label: "Testimonials",
    group: "engage",
    schema: TestimonialsProps,
    component: Testimonials as RegistryEntry["component"],
    hint: "What customers have said",
  },
  faq: {
    label: "FAQ",
    group: "engage",
    schema: FaqProps,
    component: Faq as RegistryEntry["component"],
    hint: "Answer the questions you keep getting",
  },
  newsletter: {
    label: "Newsletter",
    group: "engage",
    schema: NewsletterProps,
    component: Newsletter as RegistryEntry["component"],
    hint: "Collect email addresses",
  },
  contact: {
    label: "Contact",
    group: "engage",
    schema: ContactProps,
    component: Contact as RegistryEntry["component"],
    hint: "WhatsApp, Instagram and email buttons",
  },
  footer: {
    label: "Footer",
    group: "structure",
    schema: FooterProps,
    component: Footer as RegistryEntry["component"],
    fixed: "bottom",
    hint: "Links, socials and the small print",
  },
};

export function isSectionType(value: unknown): value is SectionType {
  return typeof value === "string" && value in REGISTRY;
}

/**
 * Validate one section's props against its own schema, filling defaults.
 *
 * Returns null rather than throwing when a section is unusable, so one bad
 * section skips instead of taking the whole page down with it. A storefront
 * that renders nine of ten sections is a far better outcome for a merchant than
 * a white screen.
 */
export function parseSectionProps(
  type: SectionType,
  props: unknown,
): Record<string, unknown> | null {
  const entry = REGISTRY[type];
  const result = entry.schema.safeParse(props ?? {});
  if (!result.success) {
    console.warn(`[render] dropping "${type}": ${result.error.issues[0]?.message}`);
    return null;
  }
  return result.data as Record<string, unknown>;
}

/** Default props for a freshly-added section, straight from its schema. */
export function defaultPropsFor(type: SectionType): Record<string, unknown> {
  const result = REGISTRY[type].schema.safeParse({});
  return result.success ? (result.data as Record<string, unknown>) : {};
}
