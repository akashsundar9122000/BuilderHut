/*
 * Guards the JavaScript shipped to a browser.
 *
 * The builder is allowed to be heavy — it is a design tool. A published
 * storefront is not: it is a small business's shopfront, opened on a phone, on
 * a slow connection, by someone who will leave. Blueprint section 51 makes that
 * split explicit and section 103 forbids shipping builder code to storefronts.
 *
 * Next 16's Turbopack build emits neither an app-route client manifest nor size
 * columns in its output, so per-route first-load JS is not measurable from the
 * build artefacts today. What IS measurable — and is the number every single
 * page pays, including every storefront — is the shared root bundle. That is
 * what this enforces.
 *
 * Per-route budgets arrive with the route-group split in Phase 1, enforced by
 * an import-boundary check (no builder module reachable from a storefront
 * entry), which is the guarantee section 103 actually cares about.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const NEXT = path.join(process.cwd(), ".next");
const MANIFEST = path.join(NEXT, "build-manifest.json");

if (!existsSync(MANIFEST)) {
  console.log("budget: no build output — run `pnpm build` first (skipping)");
  process.exit(0);
}

/*
 * Gzipped kilobytes — what a phone on a slow connection actually downloads.
 * Uncompressed sizes make React's runtime look alarming and tell you nothing
 * about the experience.
 */

/** Shared by literally every page, storefronts included. React + Next runtime. */
const SHARED_BUDGET_KB = 200;
/** All client chunks together. A ceiling on total surface, not a per-page cost. */
const TOTAL_CHUNKS_BUDGET_KB = 1200;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

function gzipSize(file) {
  try {
    return gzipSync(readFileSync(file)).length;
  } catch {
    return 0;
  }
}

function sizeOf(asset) {
  return gzipSize(path.join(NEXT, asset));
}

const shared = [...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])];
const sharedKb = Math.round(shared.reduce((n, a) => n + sizeOf(a), 0) / 1024);

function walk(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += walk(full);
    else if (entry.name.endsWith(".js")) total += gzipSize(full);
  }
  return total;
}

const chunksDir = path.join(NEXT, "static", "chunks");
const totalKb = existsSync(chunksDir) ? Math.round(walk(chunksDir) / 1024) : 0;

const rows = [
  ["shared root bundle (every page pays this)", sharedKb, SHARED_BUDGET_KB],
  ["all client chunks", totalKb, TOTAL_CHUNKS_BUDGET_KB],
];

let failed = 0;
for (const [label, kb, limit] of rows) {
  const over = kb > limit;
  if (over) failed++;
  console.log(`  ${over ? "OVER" : "ok  "}  ${String(kb).padStart(5)} KB / ${limit} KB gzipped  ${label}`);
}

if (failed > 0) {
  console.error(`\nbudget: ${failed} budget(s) exceeded\n`);
  process.exit(1);
}
console.log("budget: within limits");
