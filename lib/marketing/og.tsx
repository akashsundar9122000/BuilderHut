import { readFile } from "node:fs/promises";
import { join } from "node:path";

/*
 * Shared pieces for the social cards.
 *
 * ── Why there are font files in the repo ──────────────────────────────────
 *
 * These images are drawn by Satori, which is not a browser: it has no access
 * to the self-hosted faces next/font builds, and it cannot read a variable
 * font — which is exactly what the site's Fraunces is, custom axes and all. So
 * the card would silently fall back to a generic sans and BuilderHut's social
 * presence would be the one surface not in its own typeface.
 *
 * Two static instances, checked in and read from disk at build time, as the
 * Next docs for this file convention recommend. Fetching them from Google at
 * build time instead would make every deployment depend on a third party being
 * up, to render a picture.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/* Read once per process, not once per image. */
const FONT_DIR = join(process.cwd(), "assets", "og");

export async function ogFonts() {
  const [display, body] = await Promise.all([
    readFile(join(FONT_DIR, "fraunces-600.ttf")),
    readFile(join(FONT_DIR, "inter-400.ttf")),
  ]);

  return [
    { name: "Fraunces", data: display, style: "normal" as const, weight: 600 as const },
    { name: "Inter", data: body, style: "normal" as const, weight: 400 as const },
  ];
}

/*
 * The mark, as three strokes and a roof.
 *
 * Character-for-character the geometry in brand/mark.svg — Satori renders SVG
 * paths, so this is the same drawing rather than an approximation of it. The
 * colours are literals here because a card is not the DOM: there is no
 * stylesheet, no theme and no custom properties to resolve, which is the one
 * place the "tokens only" rule cannot apply.
 */
export function OgMark({ size = 44, ink, clay }: { size?: number; ink: string; clay: string }) {
  return (
    <svg width={size} height={size} viewBox="9.5 10.5 45 45.5" fill="none">
      <g stroke={ink} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 26 V53" />
        <path d="M23 26 H32.5 C38.5 26 38.5 38 32.5 38 H23" />
        <path d="M23 38 H34.5 C41.5 38 41.5 53 34.5 53 H23" />
      </g>
      <path
        d="M13 31 L32 14 L51 31"
        stroke={clay}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
