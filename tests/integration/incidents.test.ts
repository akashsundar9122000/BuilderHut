/*
 * The incident log, against a real Postgres.
 *
 * Worth an integration test rather than a unit one because every interesting
 * property is a property of the SQL: that recordIncident cannot throw, that a
 * secret in the detail never reaches the column, and that a row with no tenant
 * is readable — which is the whole reason the column is nullable, and exactly
 * what RLS would have taken away if this table had been tenant-scoped.
 *
 * A typo in this SQL would otherwise be discovered on a failure path in
 * production, which is the worst possible place to find out.
 */
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import {
  loadIncidentSummary,
  loadIncidents,
  recordIncident,
  resolveIncident,
} from "@/lib/platform/incidents";

const marker = `test-${Date.now().toString(36)}`;
const admin = uuidv7();

afterAll(async () => {
  await getRootDb().execute(sql`DELETE FROM platform_incidents WHERE kind LIKE ${`${marker}%`}`);
});

describe("recordIncident", () => {
  it("writes a row that the operator console can read back", async () => {
    await recordIncident({
      kind: `${marker}.plain`,
      severity: "error",
      summary: "Something broke",
      detail: { reason: "upstream refused" },
    });

    const rows = await loadIncidents(admin, { limit: 200 });
    const found = rows.find((r) => r.kind === `${marker}.plain`);

    expect(found).toBeDefined();
    expect(found!.summary).toBe("Something broke");
    expect(found!.severity).toBe("error");
    // No tenant is the case that matters: a platform-wide failure belongs to
    // nobody, and must still be visible.
    expect(found!.tenantName).toBeNull();
    expect(found!.detail).toMatchObject({ reason: "upstream refused" });
  });

  it("never lets a secret reach the column", async () => {
    await recordIncident({
      kind: `${marker}.secrets`,
      summary: "Redaction",
      detail: {
        // Every one of these keys is one somebody would plausibly pass while
        // debugging, and every one is read by a human in a browser.
        password: "hunter2",
        apiKey: "sk-live-abcdef",
        otp: "115910",
        authorization: "Bearer xyz",
        safe: "this is fine",
      },
    });

    const found = (await loadIncidents(admin, { limit: 200 })).find(
      (r) => r.kind === `${marker}.secrets`,
    )!;

    const serialised = JSON.stringify(found.detail);
    expect(serialised).not.toContain("hunter2");
    expect(serialised).not.toContain("sk-live-abcdef");
    expect(serialised).not.toContain("115910");
    expect(serialised).not.toContain("Bearer xyz");
    expect(found.detail).toMatchObject({ safe: "this is fine" });
  });

  it("turns an Error into its message and leaves the stack out", async () => {
    await recordIncident({
      kind: `${marker}.error`,
      summary: "Threw",
      detail: { error: new Error("connect ECONNREFUSED") },
    });

    const found = (await loadIncidents(admin, { limit: 200 })).find(
      (r) => r.kind === `${marker}.error`,
    )!;
    expect(found.detail).toMatchObject({ error: "connect ECONNREFUSED" });
    expect(JSON.stringify(found.detail)).not.toContain("at ");
  });

  it("does not throw when the write fails", async () => {
    /*
     * The one rule. Every call site is already on a failure path, so an
     * incident that cannot be written must not become a second, larger
     * failure — a mail outage plus a database hiccup would otherwise take
     * down signup. `kind` is varchar(60); this is not.
     */
    await expect(
      recordIncident({ kind: "x".repeat(400), summary: "too long to store" }),
    ).resolves.toBeUndefined();
  });
});

describe("the operator's view", () => {
  it("hides resolved incidents unless asked, and never deletes them", async () => {
    await recordIncident({ kind: `${marker}.resolve`, summary: "To be dealt with" });

    const before = (await loadIncidents(admin, { limit: 200 })).find(
      (r) => r.kind === `${marker}.resolve`,
    )!;
    expect(before.resolvedAt).toBeNull();

    await resolveIncident(admin, before.id);

    const outstanding = await loadIncidents(admin, { limit: 200 });
    expect(outstanding.some((r) => r.id === before.id)).toBe(false);

    // Still there — an operations log you can erase is not a log.
    const all = await loadIncidents(admin, { limit: 200, includeResolved: true });
    const after = all.find((r) => r.id === before.id);
    expect(after).toBeDefined();
    expect(after!.resolvedAt).not.toBeNull();
  });

  it("counts what is outstanding", async () => {
    await recordIncident({ kind: `${marker}.count`, severity: "error", summary: "Counted" });
    const summary = await loadIncidentSummary(admin);

    expect(summary.outstanding).toBeGreaterThan(0);
    expect(summary.errors24h).toBeGreaterThan(0);
    expect(summary.topKinds.some((k) => k.kind.startsWith(marker))).toBe(true);
  });
});
