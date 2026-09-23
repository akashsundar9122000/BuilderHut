import { z } from "zod";

/*
 * A storefront theme.
 *
 * These are the merchant's tokens, not BuilderHut's. A bakery and a streetwear
 * label must be able to look like nothing alike, so a theme carries its own
 * palette, type pairing, shape and rhythm — and the renderer emits them as CSS
 * custom properties scoped to the storefront, so changing a theme is a variable
 * swap rather than a re-render of the component tree.
 */

const Hex = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Colours must be hex, like #1c1917");

export const ThemeColorsSchema = z.object({
  background: Hex,
  surface: Hex,
  /** A second surface for alternating bands, cards on cards, footers. */
  raised: Hex,
  text: Hex,
  muted: Hex,
  border: Hex,
  primary: Hex,
  onPrimary: Hex,
  accent: Hex,
});

/**
 * Font choices are a closed set, not free text.
 *
 * Every value here maps to a family the app already loads. Accepting an
 * arbitrary string would mean either shipping a request to a third-party font
 * CDN from a merchant's storefront, or rendering in a fallback and looking
 * broken — and it is a string from the browser reaching a stylesheet.
 */
export const FONT_FAMILIES = [
  "fraunces", "playfair", "lora", "instrument",
  "inter", "dmsans", "worksans", "spacegrotesk", "archivo",
] as const;
export const FontFamilySchema = z.enum(FONT_FAMILIES);
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const ThemeTypographySchema = z.object({
  heading: FontFamilySchema,
  body: FontFamilySchema,
  /** Multiplies the whole type scale. Editorial templates run larger. */
  scale: z.number().min(0.8).max(1.4),
  headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
  headingTracking: z.number().min(-0.06).max(0.2),
  headingTransform: z.enum(["none", "uppercase"]),
});

export const ThemeShapeSchema = z.object({
  /** Corner radius in px for cards and images. 0 is a legitimate, sharp choice. */
  radius: z.number().min(0).max(32),
  buttonRadius: z.number().min(0).max(999),
  /** Vertical rhythm between sections, in px at desktop. */
  sectionSpacing: z.number().min(32).max(200),
  borderWidth: z.number().min(0).max(3),
});

export const ThemeSchema = z.object({
  colors: ThemeColorsSchema,
  typography: ThemeTypographySchema,
  shape: ThemeShapeSchema,
});

export type Theme = z.infer<typeof ThemeSchema>;
export type ThemeColors = z.infer<typeof ThemeColorsSchema>;

/** Family id to a real CSS font stack. The stacks are loaded by the storefront layout. */
export const FONT_STACKS: Record<FontFamily, string> = {
  fraunces: "var(--font-fraunces), Georgia, serif",
  playfair: "var(--font-playfair), Georgia, serif",
  lora: "var(--font-lora), Georgia, serif",
  instrument: "var(--font-instrument), Georgia, serif",
  inter: "var(--font-inter), system-ui, sans-serif",
  dmsans: "var(--font-dmsans), system-ui, sans-serif",
  worksans: "var(--font-worksans), system-ui, sans-serif",
  spacegrotesk: "var(--font-spacegrotesk), system-ui, sans-serif",
  archivo: "var(--font-archivo), system-ui, sans-serif",
};

export const FONT_LABELS: Record<FontFamily, string> = {
  fraunces: "Fraunces",
  playfair: "Playfair Display",
  lora: "Lora",
  instrument: "Instrument Serif",
  inter: "Inter",
  dmsans: "DM Sans",
  worksans: "Work Sans",
  spacegrotesk: "Space Grotesk",
  archivo: "Archivo",
};
