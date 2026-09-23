import "server-only";

import { compilePlan, describeDocument, type AiPlan, type CompiledPlan } from "./ops";
import { nvidiaConfigured, nvidiaProvider } from "./nvidia";
import { offlinePlan } from "./offline";
import type { Command } from "@/lib/builder/commands";
import type { SiteDocument } from "@/lib/schema/page";

/*
 * The assistant, end to end.
 *
 * Ask the configured model; if it is not configured, or it fails, or it times
 * out, the offline planner answers instead. Either way the result goes through
 * the same compiler, so nothing reaches the document that has not been checked
 * against the section and theme schemas.
 *
 * Nothing is applied here. This returns a proposal; the merchant looks at it
 * and decides. An assistant that edits a storefront without being asked twice
 * is a liability, and reviewing a list of named changes takes three seconds.
 */

export interface AssistantResult {
  summary: string;
  /**
   * The accepted changes, as ordinary builder commands.
   *
   * The commands travel rather than the finished document, so accepting a
   * proposal goes through the editor's own history: one undo step, the usual
   * autosave, and a labelled entry the merchant recognises. Each one was
   * already applied and validated here against the same document the client
   * holds, so replaying them is deterministic.
   */
  changes: { label: string; command: Command }[];
  rejected: { reason: string }[];
  source: "nvidia" | "offline";
  /** Why the model did not answer, when it did not. Shown to the merchant. */
  note?: string;
}

const MAX_INSTRUCTION = 500;

/*
 * A per-tenant budget, held in memory.
 *
 * Deliberately modest machinery: this stops one tab hammering the endpoint,
 * which is what it is for. It is per instance, so it is a speed bump rather
 * than a quota — the real quota belongs with plans and entitlements, where
 * billing can see it.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const recent = new Map<string, number[]>();

function withinBudget(tenantId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(tenantId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(tenantId, hits);
    return false;
  }
  hits.push(now);
  recent.set(tenantId, hits);
  return true;
}

export class AssistantError extends Error {}

export async function proposeChanges(
  tenantId: string,
  doc: SiteDocument,
  pageId: string,
  instruction: string,
): Promise<AssistantResult> {
  const trimmed = instruction.trim();
  if (!trimmed) throw new AssistantError("Tell the assistant what you'd like changed.");
  if (trimmed.length > MAX_INSTRUCTION) {
    throw new AssistantError(`Keep it under ${MAX_INSTRUCTION} characters.`);
  }
  if (!withinBudget(tenantId)) {
    throw new AssistantError("That's a lot of requests in a minute. Try again shortly.");
  }

  let source: "nvidia" | "offline" = "offline";
  let note: string | undefined;
  let plan: AiPlan | null = null;

  if (nvidiaConfigured()) {
    try {
      plan = await nvidiaProvider().plan({
        instruction: trimmed,
        context: describeDocument(doc, pageId),
      });
      source = "nvidia";
    } catch (error) {
      /*
       * Falling back rather than failing. The merchant asked for a change to
       * their shop; whether a GPU in another country answered is our problem,
       * not theirs. The note is there so they know why the answer is simpler
       * than they expected.
       */
      note =
        error instanceof Error && error.name === "AbortError"
          ? "The AI service took too long, so this was worked out locally."
          : "The AI service wasn't available, so this was worked out locally.";
      plan = null;
    }
  }

  if (!plan) plan = offlinePlan(doc, pageId, trimmed);

  const compiled: CompiledPlan = compilePlan(doc, pageId, plan);
  return {
    summary: compiled.summary,
    changes: compiled.changes.map((c) => ({ label: c.label, command: c.command })),
    rejected: compiled.rejected.map((r) => ({ reason: r.reason })),
    source,
    note,
  };
}
