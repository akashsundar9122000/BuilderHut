import type { SiteDocument } from "@/lib/schema/page";
import type { Theme } from "@/lib/schema/theme";

export interface TemplateSeed {
  storeName: string;
  tagline: string;
  industry: string;
}

export interface Template {
  id: string;
  name: string;
  /** One line, in the merchant's language, not ours. */
  blurb: string;
  /** Which trades this was designed for. Drives onboarding recommendations. */
  industries: string[];
  theme: Theme;
  /** Swatches for the template card, so the palette is visible before previewing. */
  swatches: string[];
  /** Builds the starting document. Called once, at store creation. */
  build: (seed: TemplateSeed) => SiteDocument;
}
