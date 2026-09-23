/*
 * Reads styles/tokens.css and asserts every foreground/background pair the UI
 * actually uses clears WCAG AA, in BOTH themes.
 *
 * This runs first in `pnpm verify`, before typecheck, because a contrast
 * regression is invisible in code review and obvious to a user. Adjusting a
 * token to "look right" in one theme routinely breaks the other; this is what
 * catches that.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const CSS = readFileSync(path.join(import.meta.dirname, "..", "styles", "tokens.css"), "utf8");

/** Pull the `--bh-*: #hex;` declarations out of one CSS block. */
function block(startMarker: string): Record<string, string> {
  const start = CSS.indexOf(startMarker);
  if (start === -1) throw new Error(`token block not found: ${startMarker}`);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = CSS.slice(open, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--(bh-[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

const light = block(":root {");
// The explicit-choice block is the one that must be correct; the media-query
// block above it is a byte-for-byte copy, verified separately below.
const dark = block(':root[data-theme="dark"]');

function srgb(hex: string): [number, number, number] {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = srgb(hex);
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

type Pair = { fg: string; bg: string; min: number; why: string };

/** 4.5 = AA body text. 3.0 = AA large text, icons, and meaningful non-text. */
const PAIRS: Pair[] = [
  ...["bh-canvas", "bh-surface", "bh-raised", "bh-sunken"].map((bg) => ({
    fg: "bh-text",
    bg,
    min: 4.5,
    why: "body text",
  })),
  ...["bh-canvas", "bh-surface", "bh-raised"].map((bg) => ({
    fg: "bh-text-secondary",
    bg,
    min: 4.5,
    why: "secondary text",
  })),
  ...["bh-canvas", "bh-surface", "bh-raised"].map((bg) => ({
    fg: "bh-muted",
    bg,
    min: 4.5,
    why: "muted text (labels, captions)",
  })),
  ...["bh-canvas", "bh-surface"].map((bg) => ({
    fg: "bh-faint",
    bg,
    min: 3.0,
    why: "faint text — large/decorative only",
  })),

  { fg: "bh-on-accent", bg: "bh-accent", min: 4.5, why: "primary button label" },
  { fg: "bh-on-accent", bg: "bh-accent-hover", min: 4.5, why: "primary button label, hovered" },
  ...["bh-canvas", "bh-surface"].map((bg) => ({
    fg: "bh-accent",
    bg,
    min: 4.5,
    why: "accent as link/text",
  })),
  ...["bh-canvas", "bh-surface"].map((bg) => ({
    fg: "bh-accent-2",
    bg,
    min: 4.5,
    why: "secondary accent as text",
  })),
  { fg: "bh-accent", bg: "bh-accent-soft", min: 4.5, why: "accent text on its own tint" },
  { fg: "bh-accent-2", bg: "bh-accent-2-soft", min: 4.5, why: "secondary accent on its tint" },

  ...(["success", "warning", "danger", "info"] as const).flatMap((s) => [
    { fg: `bh-${s}`, bg: "bh-surface", min: 4.5, why: `${s} text on a card` },
    { fg: `bh-${s}`, bg: "bh-canvas", min: 4.5, why: `${s} text on the page` },
    { fg: `bh-${s}`, bg: `bh-${s}-soft`, min: 4.5, why: `${s} badge text on its tint` },
  ]),

  ...[1, 2, 3, 4, 5, 6].flatMap((i) => [
    { fg: `bh-chart-${i}`, bg: "bh-canvas", min: 3.0, why: `chart series ${i} on the page` },
    { fg: `bh-chart-${i}`, bg: "bh-surface", min: 3.0, why: `chart series ${i} on a card` },
  ]),

  { fg: "bh-border-input", bg: "bh-surface", min: 3.0, why: "form control boundary (WCAG 1.4.11)" },
  { fg: "bh-border-input", bg: "bh-canvas", min: 3.0, why: "form control boundary on the page" },
  { fg: "bh-border-strong", bg: "bh-surface", min: 1.4, why: "divider must be visible, not loud" },
  { fg: "bh-accent", bg: "bh-canvas", min: 3.0, why: "focus ring against the page" },
];

let failures = 0;
let checked = 0;

for (const [themeName, tokens] of [
  ["light", light],
  ["dark", dark],
] as const) {
  for (const { fg, bg, min, why } of PAIRS) {
    const f = tokens[fg];
    const b = tokens[bg];
    if (!f || !b) {
      console.error(`  MISSING  ${themeName}: ${fg} on ${bg} — token not defined`);
      failures++;
      continue;
    }
    checked++;
    const r = ratio(f, b);
    if (r < min) {
      console.error(
        `  FAIL     ${themeName}: ${fg} on ${bg} = ${r.toFixed(2)}:1 (needs ${min}:1) — ${why}`,
      );
      failures++;
    }
  }
}

// The media-query dark block and the [data-theme="dark"] block are duplicated on
// purpose; they must not be allowed to drift apart.
const mediaDark = block(':root:not([data-theme="light"])');
for (const key of Object.keys(dark)) {
  if (mediaDark[key] !== dark[key]) {
    console.error(
      `  DRIFT    --${key}: media-query dark is ${mediaDark[key] ?? "(absent)"}, explicit dark is ${dark[key]}`,
    );
    failures++;
  }
}

if (failures > 0) {
  console.error(`\ncontrast: ${failures} problem(s) across ${checked} checked pairs\n`);
  process.exit(1);
}
console.log(`contrast: ${checked} pairs pass in both themes, dark blocks in sync`);
