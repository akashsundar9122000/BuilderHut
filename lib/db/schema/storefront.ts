import { index, jsonb, pgTable, text, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";
import { nullableTimestamp, primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";

/*
 * A website is the thing the builder edits and the storefront renders.
 *
 * draft_state holds the working document the editor autosaves into. It is never
 * read by the live storefront — publishing copies a validated snapshot into an
 * immutable site_versions row and repoints published_version_id, so a half-built
 * page can never reach a customer and a rollback is a pointer change.
 *
 * draft_revision is the optimistic-concurrency counter: the editor sends the
 * revision it started from, and a save against a stale revision is rejected
 * rather than silently clobbering someone else's work.
 */
export const websites = pgTable(
  "websites",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    templateId: text("template_id").notNull(),
    draftState: jsonb("draft_state"),
    draftRevision: integer("draft_revision").notNull().default(0),
    publishedVersionId: uuid("published_version_id"),
    publishedAt: nullableTimestamp("published_at"),
    ...timestamps(),
  },
  (t) => [
    index("websites_tenant_created_idx").on(t.tenantId, t.createdAt),
    uniqueIndex("websites_tenant_name_key").on(t.tenantId, t.name),
  ],
);

/**
 * Immutable. A published version is a historical fact — rolling back selects a
 * different row, it never edits one.
 */
export const siteVersions = pgTable(
  "site_versions",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdBy: uuid("created_by"),
    note: text("note"),
    ...timestamps(),
  },
  (t) => [
    index("site_versions_tenant_website_idx").on(t.tenantId, t.websiteId, t.versionNumber),
    uniqueIndex("site_versions_website_number_key").on(t.websiteId, t.versionNumber),
  ],
);
