import {
  Archivo,
  DM_Sans,
  Instrument_Serif,
  Lora,
  Playfair_Display,
  Space_Grotesk,
  Work_Sans,
} from "next/font/google";

/*
 * The typefaces a merchant can choose from.
 *
 * Declared once and used by BOTH the published storefront and the builder
 * canvas. They were originally only in the storefront layout, which meant the
 * theme editor's font picker changed the document but nothing on screen: the
 * canvas had no --font-archivo to resolve, so the whole custom property became
 * invalid and the text silently kept its inherited face. A font picker that
 * appears to do nothing is worse than no font picker.
 *
 * next/font subsets and self-hosts these, so a merchant's storefront makes no
 * request to a third-party font CDN — which matters for speed and for not
 * handing a customer's IP address to Google on every page view.
 *
 * Fraunces and Inter come from the root layout; these are the rest.
 */

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-worksans", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-spacegrotesk", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });

/** Put this on any element that contains storefront-rendered sections. */
export const STOREFRONT_FONT_VARS = [
  playfair,
  lora,
  instrument,
  dmSans,
  workSans,
  spaceGrotesk,
  archivo,
]
  .map((font) => font.variable)
  .join(" ");
