"use server";

import { requireActor } from "@/lib/auth/session";
import {
  listVersions,
  publishDraft,
  restoreVersion,
  saveDraft,
  type SaveDraftResult,
  type VersionSummary,
} from "@/lib/builder/service";
import type { SiteDocument } from "@/lib/schema/page";

/*
 * Server actions for the builder.
 *
 * Each one re-establishes the actor: a server action is a public endpoint, and
 * the tenant comes from the session rather than from anything the client sends.
 */

export async function saveDraftAction(
  doc: SiteDocument,
  expectedRevision: number,
): Promise<SaveDraftResult> {
  await requireActor();
  return saveDraft(doc, expectedRevision);
}

export async function publishAction(note?: string) {
  await requireActor();
  return publishDraft(note);
}

export async function listVersionsAction(): Promise<VersionSummary[]> {
  await requireActor();
  return listVersions();
}

export async function restoreVersionAction(versionId: string) {
  await requireActor();
  return restoreVersion(versionId);
}
