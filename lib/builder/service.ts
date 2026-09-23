import "server-only";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { uuidv7 } from "uuidv7";

import { runForTenant } from "@/lib/auth/session";
import { auditLogs, siteVersions, websites } from "@/lib/db/schema";
import { SCHEMA_VERSION, SiteDocumentSchema, type SiteDocument } from "@/lib/schema/page";
import { buildDocument } from "@/lib/templates";

/*
 * Draft and publish.
 *
 * The draft is a JSONB column the editor writes to constantly. Publishing
 * copies a validated snapshot into an immutable site_versions row and repoints
 * websites.published_version_id — so the live storefront can never read a
 * half-finished edit, and rolling back is choosing a different row rather than
 * undoing anything.
 */

export interface DraftState {
  websiteId: string;
  doc: SiteDocument;
  revision: number;
  publishedVersionId: string | null;
  publishedAt: Date | null;
}

export async function loadDraft(): Promise<DraftState | null> {
  return runForTenant(async (db) => {
    const rows = await db.select(websites).limit(1);
    const site = rows[0];
    if (!site) return null;

    /*
     * A website with no draft yet falls back to its published version, and
     * failing that rebuilds from its template. Neither should happen, but a
     * merchant opening the builder to an error because a column is null is a
     * far worse outcome than rebuilding a document we know how to rebuild.
     */
    let source: unknown = site.draftState;
    if (!source && site.publishedVersionId) {
      const versions = await db
        .select(siteVersions)
        .where(eq(siteVersions.id, site.publishedVersionId))
        .limit(1);
      source = versions[0]?.snapshot;
    }

    const parsed = SiteDocumentSchema.safeParse(source);
    const doc = parsed.success
      ? parsed.data
      : buildDocument(site.templateId, {
          storeName: site.name,
          tagline: "",
          industry: "other",
        });

    return {
      websiteId: site.id,
      doc,
      revision: site.draftRevision,
      publishedVersionId: site.publishedVersionId,
      publishedAt: site.publishedAt,
    };
  });
}

export type SaveDraftResult =
  | { ok: true; revision: number }
  | { ok: false; conflict: true; revision: number; serverDoc: SiteDocument }
  | { ok: false; conflict: false; message: string };

/**
 * Save the draft, rejecting a write based on a revision that has moved on.
 *
 * The editor is optimistic — it applies a change locally and tells the server
 * afterwards — so without this, two tabs (or two staff members) would take
 * turns overwriting each other with no sign that anything was lost. The client
 * sends the revision it started from; a mismatch returns the server's document
 * so the editor can reload onto it rather than clobbering work it never saw.
 */
export async function saveDraft(
  doc: unknown,
  expectedRevision: number,
): Promise<SaveDraftResult> {
  const parsed = SiteDocumentSchema.safeParse(doc);
  if (!parsed.success) {
    // The document is rebuilt from validated commands on the client, so this
    // means either a bug or a hand-crafted request. Neither gets written.
    console.error("[saveDraft] rejected an invalid document:", parsed.error.issues[0]);
    return { ok: false, conflict: false, message: "That change could not be saved." };
  }

  return runForTenant(async (db) => {
    const rows = await db.select(websites).limit(1);
    const site = rows[0];
    if (!site) return { ok: false, conflict: false, message: "No store found." };

    if (site.draftRevision !== expectedRevision) {
      const current = SiteDocumentSchema.safeParse(site.draftState);
      if (!current.success) {
        return { ok: false, conflict: false, message: "The saved draft could not be read." };
      }
      return {
        ok: false,
        conflict: true,
        revision: site.draftRevision,
        serverDoc: current.data,
      };
    }

    const revision = site.draftRevision + 1;
    await db.update(
      websites,
      { draftState: parsed.data, draftRevision: revision },
      eq(websites.id, site.id),
    );
    return { ok: true, revision };
  });
}

export interface PublishResult {
  ok: boolean;
  versionNumber?: number;
  message?: string;
}

/**
 * Publish the current draft as a new immutable version.
 *
 * The snapshot, the version pointer and the audit row are written in one
 * transaction: a version that exists but is not pointed at is invisible, and a
 * pointer to a version that failed to write is a broken storefront.
 */
export async function publishDraft(note?: string): Promise<PublishResult> {
  return runForTenant(async (db) => {
    const rows = await db.select(websites).limit(1);
    const site = rows[0];
    if (!site) return { ok: false, message: "No store found." };

    const parsed = SiteDocumentSchema.safeParse(site.draftState);
    if (!parsed.success) {
      return { ok: false, message: "This draft has a problem and cannot be published yet." };
    }

    const versions = await db.select(siteVersions).orderBy(siteVersions.versionNumber);
    const versionNumber = (versions.at(-1)?.versionNumber ?? 0) + 1;
    const versionId = uuidv7();

    await db.insert(siteVersions, {
      id: versionId,
      websiteId: site.id,
      versionNumber,
      schemaVersion: SCHEMA_VERSION,
      snapshot: parsed.data,
      createdBy: db.ctx.actorId,
      note: note ?? null,
    });

    await db.update(
      websites,
      { publishedVersionId: versionId, publishedAt: new Date() },
      eq(websites.id, site.id),
    );

    await db.raw.insert(auditLogs).values({
      id: uuidv7(),
      tenantId: db.ctx.tenantId,
      actorId: db.ctx.actorId,
      actorRole: db.ctx.role,
      action: "store.published",
      entityType: "site_version",
      entityId: versionId,
      metadata: { versionNumber },
    });

    /*
     * updateTag rather than revalidateTag: the merchant will click straight
     * through to their store, and read-your-own-writes is the difference
     * between "published" meaning something and meaning "in a few minutes".
     */
    updateTag("storefront");

    return { ok: true, versionNumber };
  });
}

export interface VersionSummary {
  id: string;
  versionNumber: number;
  createdAt: Date;
  note: string | null;
  isLive: boolean;
}

export async function listVersions(): Promise<VersionSummary[]> {
  return runForTenant(async (db) => {
    const sites = await db.select(websites).limit(1);
    const site = sites[0];
    if (!site) return [];

    const versions = await db.select(siteVersions).orderBy(siteVersions.versionNumber).limit(50);
    return versions
      .map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        createdAt: v.createdAt,
        note: v.note,
        isLive: v.id === site.publishedVersionId,
      }))
      .reverse();
  });
}

/**
 * Restore a published version into the draft.
 *
 * Restoring copies the old snapshot into the draft rather than repointing the
 * live pointer, so the merchant gets to look at it and publish deliberately.
 * A one-click change to what customers see, with no confirmation, is not a
 * feature — and published versions stay immutable either way.
 */
export async function restoreVersion(versionId: string): Promise<{ ok: boolean; message?: string }> {
  return runForTenant(async (db) => {
    const rows = await db.select(siteVersions).where(eq(siteVersions.id, versionId)).limit(1);
    const version = rows[0];
    if (!version) return { ok: false, message: "That version no longer exists." };

    const parsed = SiteDocumentSchema.safeParse(version.snapshot);
    if (!parsed.success) return { ok: false, message: "That version cannot be read." };

    const sites = await db.select(websites).limit(1);
    const site = sites[0];
    if (!site) return { ok: false, message: "No store found." };

    await db.update(
      websites,
      { draftState: parsed.data, draftRevision: site.draftRevision + 1 },
      eq(websites.id, site.id),
    );
    return { ok: true };
  });
}
