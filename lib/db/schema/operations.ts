import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, primaryId } from "./_shared";

/*
 * Append-only. Audit rows are written in the same transaction as the mutation
 * they describe, so an action cannot succeed while its record of having happened
 * fails. PLATFORM-classified because platform admins read across tenants.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id"),
    actorId: uuid("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    /** Redacted before write — never store a password, token or card number here. */
    metadata: jsonb("metadata"),
    requestId: text("request_id"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("audit_logs_action_created_idx").on(t.action, t.createdAt),
  ],
);
