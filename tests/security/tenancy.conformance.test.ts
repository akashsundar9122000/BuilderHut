/*
 * Reads the migration SQL — the thing that actually ran — and asserts the
 * tenancy invariants hold for every table in the database.
 *
 * Parsing SQL rather than introspecting the Drizzle objects is deliberate: the
 * schema files describe intent, the migrations describe reality, and it is the
 * gap between those two that this is meant to catch. It also means the test
 * needs no database connection, so it runs in the fast CI job.
 *
 * The highest-value assertion here is the leading-tenant_id index. Getting it
 * wrong breaks nothing visibly; it just makes every query in the product scan
 * more as data grows, and nobody notices until it is expensive to fix.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GLOBAL_OR_SCOPED, PLATFORM, TENANT_SCOPED } from "@/lib/db/schema";

const MIGRATIONS = path.join(import.meta.dirname, "..", "..", "drizzle", "migrations");

const sql = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(path.join(MIGRATIONS, f), "utf8"))
  .join("\n");

/** Table name -> the body of its CREATE TABLE statement. */
function createdTables(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"(\w+)" \(([\s\S]*?)\n\);/g)) {
    out.set(m[1]!, m[2]!);
  }
  return out;
}

const tables = createdTables();
const tenantScoped = [...TENANT_SCOPED];

describe("table classification", () => {
  it("classifies every table in the migrations exactly once", () => {
    const unclassified: string[] = [];
    const duplicated: string[] = [];
    for (const name of tables.keys()) {
      const hits = [TENANT_SCOPED.has(name), GLOBAL_OR_SCOPED.has(name), PLATFORM.has(name)].filter(
        Boolean,
      ).length;
      if (hits === 0) unclassified.push(name);
      if (hits > 1) duplicated.push(name);
    }
    expect(unclassified, "add these to a set in lib/db/schema/index.ts").toEqual([]);
    expect(duplicated, "these appear in more than one classification set").toEqual([]);
  });

  it("does not classify tables that do not exist", () => {
    const all = [...TENANT_SCOPED, ...GLOBAL_OR_SCOPED, ...PLATFORM];
    const missing = all.filter((t) => !tables.has(t));
    expect(missing, "classified but never created by a migration").toEqual([]);
  });

  it("keeps the ambiguous 'maybe shared' set small", () => {
    // A nullable tenant_id is where isolation bugs hide: the query that forgets
    // the NULL branch leaks the catalogue, and the one that forgets the value
    // branch leaks a merchant's copy. Every entry here should be justified.
    expect(GLOBAL_OR_SCOPED.size).toBeLessThanOrEqual(8);
  });
});

describe.each(tenantScoped)("tenant-scoped table: %s", (table) => {
  const body = () => {
    const b = tables.get(table);
    if (!b) throw new Error(`no CREATE TABLE found for ${table}`);
    return b;
  };

  it("has a NOT NULL tenant_id", () => {
    expect(body()).toMatch(/"tenant_id" uuid NOT NULL/);
  });

  it("has a foreign key to tenants", () => {
    const fk = new RegExp(
      `ALTER TABLE "${table}" ADD CONSTRAINT[\\s\\S]*?FOREIGN KEY \\("tenant_id"\\) REFERENCES "public"\\."tenants"`,
    );
    expect(sql).toMatch(fk);
  });

  it("has an index whose FIRST column is tenant_id", () => {
    const indexes = [
      ...sql.matchAll(new RegExp(`CREATE (?:UNIQUE )?INDEX "\\w+" ON "${table}"[^;]*?;`, "g")),
    ].map((m) => m[0]);
    const leading = indexes.filter((i) => /USING btree \("tenant_id"/.test(i));
    expect(
      leading.length,
      `${table} has no index leading with tenant_id — every scoped query would scan.\nIndexes found:\n${indexes.join("\n")}`,
    ).toBeGreaterThan(0);
  });

  it("has row-level security enabled and forced", () => {
    expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
    expect(sql).toMatch(new RegExp(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`));
  });

  it("has a tenant isolation policy that is NULL-safe", () => {
    const policy = new RegExp(`CREATE POLICY "${table}_tenant_isolation" ON "${table}"[\\s\\S]*?;`);
    const match = sql.match(policy);
    expect(match, `no isolation policy for ${table}`).not.toBeNull();
    // NULLIF matters: without it, an unset context raises 22P02 on a reused
    // pooled connection instead of matching zero rows. See migration 0002.
    const last = [...sql.matchAll(new RegExp(policy.source, "g"))].pop();
    expect(last![0]).toContain("NULLIF(current_setting('app.tenant_id', true), '')");
  });
});

describe("money columns", () => {
  it("never stores money as a floating point type", () => {
    const offenders: string[] = [];
    for (const [name, body] of tables) {
      for (const line of body.split("\n")) {
        if (/(price|amount|total|subtotal|fee|cost|revenue|gmv)/i.test(line)) {
          if (/\b(real|double precision|float)\b/i.test(line)) {
            offenders.push(`${name}: ${line.trim()}`);
          }
        }
      }
    }
    expect(offenders, "money must be integer minor units or numeric, never a float").toEqual([]);
  });
});
