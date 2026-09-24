#!/usr/bin/env node
/*
 * Looks at the guide's screenshots, rather than at the list of their filenames.
 *
 * A capture that lost its stylesheet still writes a valid WebP, of the right
 * size, under the right name, and passes every other check there is. Forty-three
 * of sixty-seven shipped that way once — raw HTML, Times, blue links — and the
 * thing that caught it was a person opening the page and saying so.
 *
 * The test is not "is it white". White was the obvious signal and it was wrong:
 * --bh-surface is #ffffff in light mode, so a card-heavy dashboard is honestly
 * almost all white, and the check failed it.
 *
 * The test is that a page photographed in both themes must LOOK different in
 * them. A document with no stylesheet has no theme, so its two captures are
 * pixel-for-pixel the same — which is exactly what every one of those
 * forty-three looked like. Anything genuinely themeless (a storefront, or the
 * builder's preview of one) declares a single theme and is never compared.
 *
 *   node scripts/check-guide-shots.mjs
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "public", "guide-shots");
const GUIDE = path.join(ROOT, "docs", "guide");

/*
 * Mean per-pixel difference between the light and dark captures, 0–255.
 * Real pairs in this repo score 48 and up; an unthemed pair scores under 8.
 * Twenty is comfortably between them and nowhere near either.
 */
const THEME_DIFFERENCE = 20;
const MAX_FILE_BYTES = 150 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

if (!fs.existsSync(DIR)) {
  console.log("check:shots — nothing captured yet");
  process.exit(0);
}

const problems = [];
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".webp"));

/* ── what the guide asks for, against what exists ─────────────────────── */

const referenced = new Set();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".md")) {
      for (const m of fs.readFileSync(full, "utf8").matchAll(/]\(shot:([a-z0-9-]+)/g)) referenced.add(m[1]);
    }
  }
};
if (fs.existsSync(GUIDE)) walk(GUIDE);

const captured = new Set(files.map((f) => f.split("--")[0]));
for (const id of referenced) {
  if (!captured.has(id)) problems.push(`${id}: the guide references it, but it has never been captured`);
}
const orphans = [...captured].filter((id) => !referenced.has(id)).sort();

/* ── weight ───────────────────────────────────────────────────────────── */

let total = 0;
for (const file of files) {
  const bytes = fs.statSync(path.join(DIR, file)).size;
  total += bytes;
  if (bytes > MAX_FILE_BYTES) {
    problems.push(`${file}: ${(bytes / 1024).toFixed(0)} KB, over the ${MAX_FILE_BYTES / 1024} KB per-file limit`);
  }
}
if (total > MAX_TOTAL_BYTES) {
  problems.push(`public/guide-shots is ${(total / 1024 / 1024).toFixed(1)} MB, over the 8 MB budget`);
}

/* ── did the stylesheet arrive ────────────────────────────────────────── */

const pairs = {};
for (const file of files) {
  const m = file.match(/^(.*)--(desktop|phone)--(light|dark)\.webp$/);
  if (m) (pairs[`${m[1]}--${m[2]}`] ??= {})[m[3]] = file;
}

const browser = await chromium.launch();
const page = await browser.newPage();

for (const [key, variants] of Object.entries(pairs)) {
  if (!variants.light || !variants.dark) continue; // declared single-theme
  const [light, dark] = [variants.light, variants.dark].map((f) =>
    fs.readFileSync(path.join(DIR, f)).toString("base64"),
  );

  const difference = await page.evaluate(async ([a, b]) => {
    const pixels = async (b64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/webp;base64,${b64}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    };
    const [A, B] = await Promise.all([pixels(a), pixels(b)]);
    if (A.length !== B.length) return 255; // different sizes: certainly not the same render
    let sum = 0;
    for (let i = 0; i < A.length; i += 4) sum += Math.abs(A[i] - B[i]);
    return sum / (A.length / 4);
  }, [light, dark]);

  if (difference < THEME_DIFFERENCE) {
    problems.push(
      `${key}: its light and dark captures are all but identical (${difference.toFixed(1)}), ` +
        "so the page rendered with no stylesheet — or it is genuinely themeless and should declare one theme",
    );
  }
}

await browser.close();

/* ── report ───────────────────────────────────────────────────────────── */

if (orphans.length) {
  console.warn(`check:shots — ${orphans.length} captured but not referenced by any page:`);
  for (const id of orphans) console.warn(`  ${id}`);
}

if (problems.length) {
  console.error(`\ncheck:shots FAILED — ${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error("\nRun `pnpm guide:shots` to recapture.\n");
  process.exit(1);
}

console.log(
  `check:shots ok — ${files.length} pictures, ${(total / 1024 / 1024).toFixed(1)} MB, every themed pair genuinely themed`,
);
