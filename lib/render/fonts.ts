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
 *
 * `preload: false` on all seven, which is a deliberate trade and not an
 * oversight. next/font emits a <link rel="preload"> per declared face, so with
 * it on, any page carrying these variables front-runs SEVEN font files ahead of
 * its own hero — including the marketing site, where they are only ever used
 * for 13px text inside miniature shop previews. A storefront gives up very
 * little for that: this CSS is inlined into the document head, so the browser
 * discovers the face as soon as it parses the page rather than milliseconds
 * earlier, and `display: swap` was already the chosen behaviour either way. It
 * also stops every storefront preloading the five faces its own theme does not
 * use.
 */

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap", preload: false });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", display: "swap", preload: false });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-worksans", display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-spacegrotesk", display: "swap", preload: false });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", preload: false });

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
