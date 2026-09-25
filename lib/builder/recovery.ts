import type { SiteDocument } from "@/lib/schema/page";

/*
 * A copy of the draft in the browser, so a crash cannot cost an afternoon.
 *
 * The server autosave is debounced at 1.2 seconds, which is the right trade
 * for a network round trip and the wrong one for a tab that dies: everything
 * typed since the last acknowledged save exists only in React state, and React
 * state does not survive an unmounted tree. On 2026-09-25 an oversized image
 * upload threw inside a Server Action's transport, the tree unmounted, and a
 * draft went back to whatever the server had last confirmed.
 *
 * This is the local half of blueprint section 6.8, which the plan called for
 * and nothing implemented. It writes on a much shorter timer than the network
 * save, because writing to localStorage costs nothing and the whole point is
 * to be ahead of the server rather than behind it.
 *
 * ── The rule that makes restoring safe ────────────────────────────────────
 *
 * A snapshot records the server revision it was based on. On load it is
 * restored ONLY when that revision still matches what the server just handed
 * us. If they differ, somebody else saved in the meantime and the snapshot is
 * built on a document that no longer exists — restoring it would silently
 * overwrite their work with a stale copy. In that case it is discarded, which
 * loses at most the local edits and never anybody else's.
 */

const PREFIX = "bh:draft:";
/** Beyond this a snapshot is more likely to confuse than to help. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface DraftSnapshot {
  doc: SiteDocument;
  /** The server revision this work was built on. */
  revision: number;
  savedAt: number;
}

function key(websiteId: string): string {
  return `${PREFIX}${websiteId}`;
}

/*
 * Every one of these is wrapped. localStorage throws rather than returning
 * null in a private window, with site data blocked, and when the quota is
 * full — and a draft recovery that breaks the editor is worse than no draft
 * recovery at all.
 */

export function writeSnapshot(websiteId: string, snapshot: DraftSnapshot): void {
  try {
    localStorage.setItem(key(websiteId), JSON.stringify(snapshot));
  } catch {
    // Quota, or storage denied. Nothing to do and nothing worth saying: the
    // server save is still the primary path.
  }
}

export function clearSnapshot(websiteId: string): void {
  try {
    localStorage.removeItem(key(websiteId));
  } catch {
    /* see above */
  }
}

/**
 * The snapshot worth restoring, or null.
 *
 * `serverRevision` is what the page was just handed. A snapshot from a
 * different revision is discarded here rather than returned with a warning,
 * because there is no version of "restore this over somebody else's newer
 * work" that is the right default.
 */
export function readSnapshot(websiteId: string, serverRevision: number): DraftSnapshot | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(websiteId));
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: DraftSnapshot;
  try {
    parsed = JSON.parse(raw) as DraftSnapshot;
  } catch {
    clearSnapshot(websiteId);
    return null;
  }

  const usable =
    parsed &&
    typeof parsed.revision === "number" &&
    typeof parsed.savedAt === "number" &&
    parsed.doc != null;

  if (!usable || parsed.revision !== serverRevision || Date.now() - parsed.savedAt > MAX_AGE_MS) {
    clearSnapshot(websiteId);
    return null;
  }

  return parsed;
}
