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
import { checkReadiness, type Readiness } from "@/lib/builder/readiness";
import { AssistantError, proposeChanges, type AssistantResult } from "@/lib/ai/assistant";
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

export async function readinessAction(): Promise<Readiness> {
  await requireActor();
  return checkReadiness();
}

export async function publishAction(note?: string) {
  await requireActor();

  /*
   * Checked again here, not only in the panel. The panel is a courtesy; this
   * is the rule. A shop with no delivery option has a checkout that cannot
   * complete, and publishing it would hand a merchant a shopfront that takes
   * orders nobody can pay for.
   */
  const readiness = await checkReadiness();
  if (!readiness.canPublish) {
    return {
      ok: false,
      message: readiness.blockers[0]?.label ?? "This shop isn't ready to publish yet.",
    };
  }

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

export type AssistantActionResult =
  | ({ ok: true } & AssistantResult)
  | { ok: false; message: string };

/**
 * Ask the assistant for a plan.
 *
 * The document comes from the client because the client holds the unsaved
 * draft — but it is re-validated by the compiler before anything comes back,
 * and the result is only a proposal. Nothing is written until the merchant
 * accepts it and the ordinary autosave path runs.
 */
export async function assistantAction(
  doc: SiteDocument,
  pageId: string,
  instruction: string,
): Promise<AssistantActionResult> {
  const actor = await requireActor();
  if (!actor.tenantId) return { ok: false, message: "Open a shop before using the assistant." };
  try {
    const result = await proposeChanges(actor.tenantId, doc, pageId, instruction);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof AssistantError) return { ok: false, message: error.message };
    console.error("[assistantAction]", error);
    return { ok: false, message: "The assistant couldn't answer just now." };
  }
}
