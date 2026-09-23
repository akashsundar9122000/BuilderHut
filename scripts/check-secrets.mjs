/*
 * Fails the build if something that looks like a credential is tracked by git.
 *
 * Scans tracked files only — an ignored .env.local is exactly where these values
 * are supposed to live. The point is to catch the moment one gets pasted into a
 * source file, a test fixture or a README, because once it is in a commit it is
 * in the history whether or not the next commit removes it.
 */
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS = [
  // The password segment excludes $ and { so that variable references —
  // postgresql://$USER:$PASSWORD@host, or ${{ secrets.X }} — are not reported.
  // Those are how a credential is SUPPOSED to appear in a committed file.
  [/postgres(?:ql)?:\/\/[^\s"'`]*:[^\s"'`@${]+@/i, "Postgres connection string with a password"],
  [/\bnpg_[A-Za-z0-9]{12,}/, "Neon credential"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "OpenAI-style secret key"],
  [/\bnvapi-[A-Za-z0-9_-]{20,}/, "NVIDIA API key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key id"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "Private key"],
  [/\bghp_[A-Za-z0-9]{30,}/, "GitHub personal access token"],
];

// .env.example documents the SHAPE of these values; its placeholders are not secrets.
const ALLOW = new Set([".env.example", "scripts/check-secrets.mjs"]);

const files = execSync("git ls-files -z", { encoding: "utf8" }).split("\0").filter(Boolean);

let found = 0;
for (const file of files) {
  if (ALLOW.has(file)) continue;
  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > 2_000_000) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // binary
  }

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const [pattern, label] of PATTERNS) {
      if (pattern.test(lines[i])) {
        console.error(`  ${file}:${i + 1} — ${label}`);
        found++;
      }
    }
  }
}

if (found > 0) {
  console.error(
    `\nsecrets: ${found} possible credential(s) in tracked files.\nMove them to .env.local (gitignored) and rotate anything already committed.\n`,
  );
  process.exit(1);
}
console.log(`secrets: ${files.length} tracked files clean`);
