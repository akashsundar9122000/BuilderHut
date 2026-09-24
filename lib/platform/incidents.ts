import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb, rowsOf } from "@/lib/db/client";
import { withPlatformAdmin } from "@/lib/db/tenant";

/*
 * Recording, and reading, the things that went wrong.
 *
 * ── The one rule for recordIncident: it must never throw ──────────────────
 *
 * Every call site is already on a failure path. If writing "the email did not
 * send" can itself fail, then a mail outage plus a database hiccup takes down
 * signup — the reporting of a problem becoming a second, larger problem. So
 * every error in here is swallowed and logged, and the caller's own error
 * handling is left to run exactly as it did before.
 *
 * It also deliberately does NOT join the caller's transaction. An incident is
 * a record that something failed; attaching it to a transaction that is about
 * to roll back would delete the only evidence at the moment it is needed.
 */

export type IncidentSeverity = "info" | "warning" | "error";

export interface IncidentInput {
  /** A stable slug, so the console can group: "email.send_failed". */
  kind: string;
  summary: string;
  severity?: IncidentSeverity;
  tenantId?: string | null;
  detail?: Record<string, unknown>;
}

/*
 * Keys whose values never reach the incident log.
 *
 * Same reasoning as audit_logs.metadata, and learned the hard way elsewhere in
 * this codebase: a verification subject line carrying a live one-time code was
 * logged to production for ten minutes. Incidents are read by a person in a
 * browser, so a token pasted into one is a token on a screen.
 */
const REDACT = /pass|secret|token|key|otp|code|authorization|cookie|signature/i;

function scrub(detail: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (REDACT.test(key)) {
      out[key] = "[redacted]";
    } else if (value instanceof Error) {
      // The message, never the stack: a stack is long, and on a serverless
      // build it names paths rather than anything an operator can act on.
      out[key] = value.message;
    } else if (typeof value === "string" && value.length > 500) {
      out[key] = `${value.slice(0, 500)}…`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export async function recordIncident(input: IncidentInput): Promise<void> {
  try {
    const detail = input.detail ? scrub(input.detail) : null;
    await getRootDb().execute(sql`
      INSERT INTO platform_incidents (id, tenant_id, severity, kind, summary, detail)
      VALUES (
        ${uuidv7()},
        ${input.tenantId ?? null},
        ${input.severity ?? "error"},
        ${input.kind},
        ${input.summary},
        ${detail ? JSON.stringify(detail) : null}::jsonb
      )
    `);
  } catch (error) {
    // The console is the fallback, and the last one. Never rethrow.
    console.error(`[incidents] could not record ${input.kind}:`, error);
  }
}

export interface IncidentRow {
  id: string;
  severity: IncidentSeverity;
  kind: string;
  summary: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  resolvedAt: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
}

export async function loadIncidents(
  actorId: string,
  { limit = 120, includeResolved = false } = {},
): Promise<IncidentRow[]> {
  return withPlatformAdmin(actorId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT i.id, i.severity, i.kind, i.summary, i.detail,
             i.created_at::text AS "createdAt",
             i.resolved_at::text AS "resolvedAt",
             t.name AS "tenantName", t.slug AS "tenantSlug"
      FROM platform_incidents i
      LEFT JOIN tenants t ON t.id = i.tenant_id
      WHERE ${includeResolved ? sql`true` : sql`i.resolved_at IS NULL`}
      ORDER BY i.created_at DESC
      LIMIT ${limit}
    `);
    return rowsOf<IncidentRow>(result);
  });
}

export interface IncidentSummary {
  outstanding: number;
  errors24h: number;
  /** The noisiest kinds in the last week — where to look first. */
  topKinds: { kind: string; count: number }[];
}

export async function loadIncidentSummary(actorId: string): Promise<IncidentSummary> {
  return withPlatformAdmin(actorId, async (tx) => {
    const counts = rowsOf<{ outstanding: number; errors24h: number }>(
      await tx.execute(sql`
        SELECT
          count(*) FILTER (WHERE resolved_at IS NULL)::int AS outstanding,
          count(*) FILTER (WHERE severity = 'error'
                             AND created_at > now() - interval '24 hours')::int AS "errors24h"
        FROM platform_incidents
      `),
    )[0] ?? { outstanding: 0, errors24h: 0 };

    const topKinds = rowsOf<{ kind: string; count: number }>(
      await tx.execute(sql`
        SELECT kind, count(*)::int AS count
        FROM platform_incidents
        WHERE created_at > now() - interval '7 days'
        GROUP BY kind
        ORDER BY count DESC
        LIMIT 5
      `),
    );

    return { outstanding: counts.outstanding, errors24h: counts.errors24h, topKinds };
  });
}

/** Mark one as dealt with. The row stays; history is not editable. */
export async function resolveIncident(actorId: string, incidentId: string): Promise<void> {
  await withPlatformAdmin(actorId, (tx) =>
    tx.execute(sql`
      UPDATE platform_incidents
      SET resolved_at = now(), resolved_by = ${actorId}
      WHERE id = ${incidentId} AND resolved_at IS NULL
    `),
  );
}
