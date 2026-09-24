import { index, jsonb, pgEnum, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, nullableTimestamp, primaryId } from "./_shared";

/*
 * Things that went wrong, kept where an operator can see them.
 *
 * Until this table, a failed payment webhook, a bounced verification email or
 * a cron run that threw existed only as a console.error in the hosting
 * provider's log stream — searchable by whoever remembers to go and look, gone
 * after the retention window, and invisible to the person whose job is to
 * notice. The operator console listed "Incidents" under "not built yet"
 * because there was nothing to build it from.
 *
 * PLATFORM, not tenant-scoped, and that is the interesting decision. Most
 * incidents DO belong to a store and carry its tenant_id so the console can
 * say whose shop broke — but the ones that matter most are the ones that
 * belong to nobody: the nightly rollup failing, SMTP being down for everyone.
 * A tenant-scoped table cannot hold a row with no tenant, and RLS would then
 * hide exactly the platform-wide failures this exists to surface. So the
 * column is nullable, the table is read only through withPlatformAdmin, and
 * nothing merchant-facing reads it at all.
 */

export const incidentSeverity = pgEnum("incident_severity", [
  // Worth knowing, nothing is broken for anyone.
  "info",
  // One person's action failed. They may not have noticed.
  "warning",
  // A feature is failing repeatedly, or for everyone.
  "error",
]);

export const platformIncidents = pgTable(
  "platform_incidents",
  {
    id: primaryId(),
    /*
     * Nullable on purpose — see above. No foreign key to tenants either: an
     * incident is a record of history, and deleting a shop should not delete
     * the evidence of what it did on the way out.
     */
    tenantId: uuid("tenant_id"),
    severity: incidentSeverity("severity").notNull().default("error"),
    /** A stable slug — "email.send_failed", "payment.webhook_rejected". */
    kind: varchar("kind", { length: 60 }).notNull(),
    /** One line, in plain words, safe to show on a screen. */
    summary: text("summary").notNull(),
    /**
     * The technical detail: a message, a status code, a provider's reason.
     *
     * Never a secret. recordIncident redacts before it writes, on the same
     * reasoning as audit_logs.metadata — this is read by a human in a browser,
     * and an access token pasted into it is an access token on a screen.
     */
    detail: jsonb("detail"),
    /** Set when an operator has dealt with it. Null means outstanding. */
    resolvedAt: nullableTimestamp("resolved_at"),
    resolvedBy: uuid("resolved_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("platform_incidents_created_idx").on(t.createdAt),
    index("platform_incidents_kind_created_idx").on(t.kind, t.createdAt),
    index("platform_incidents_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);
