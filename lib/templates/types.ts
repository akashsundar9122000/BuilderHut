import type { SiteDocument } from "@/lib/schema/page";
import type { Theme } from "@/lib/schema/theme";

export interface TemplateSeed {
  storeName: string;
  tagline: string;
  industry: string;
}

/*
 * A template minus its `build` function.
 *
 * A Template cannot cross the server/client boundary: React refuses to
 * serialize the function, and the error names the field rather than the reason.
 * Anything rendered in a client component takes this instead — which is also
 * the right shape, because the builder is not something a marketing page needs.
 */
export interface TemplateSummary {
  id: string;
  name: string;
  blurb: string;
  industries: string[];
  theme: Theme;
  swatches: string[];
}

export interface Template extends TemplateSummary {
  /** Builds the starting document. Called once, at store creation. */
  build: (seed: TemplateSeed) => SiteDocument;
}
