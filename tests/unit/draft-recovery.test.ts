import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSnapshot, readSnapshot, writeSnapshot } from "@/lib/builder/recovery";
import type { SiteDocument } from "@/lib/schema/page";

/*
 * The local draft snapshot.
 *
 * Worth testing because the failure it guards against already happened — an
 * upload threw inside a Server Action's transport, React unmounted the tree,
 * and every edit since the last 1.2s autosave went with it — and because the
 * restore rule is the kind of thing that looks obviously right and is
 * obviously wrong once two people share a shop.
 */

const doc = (title: string) =>
  ({ schemaVersion: 1, theme: {}, pages: [{ id: "p1", title }], settings: {} }) as unknown as SiteDocument;

const SITE = "thread-and-bloom";

/*
 * A localStorage of about thirty lines, rather than a jsdom dependency for one
 * file. The module under test uses four methods and cares far more about how
 * they FAIL than about DOM fidelity — a private window, blocked site data, a
 * full quota — and a stub makes throwing on demand trivial where jsdom makes
 * it awkward.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  key(i: number) { return [...this.store.keys()][i] ?? null; }
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal("localStorage", storage);
  storage.clear();
});

describe("draft snapshots", () => {
  it("returns work saved against the revision the server still has", () => {
    writeSnapshot(SITE, { doc: doc("unsaved"), revision: 7, savedAt: Date.now() });

    const found = readSnapshot(SITE, 7);
    expect(found).not.toBeNull();
    expect(found!.doc.pages[0]!.title).toBe("unsaved");
  });

  it("refuses work built on a revision somebody else has moved past", () => {
    /*
     * The property that matters. A snapshot at revision 7 describes a document
     * that no longer exists once the server is at 9 — restoring it would push
     * a stale copy over a colleague's newer save, and do it silently. Losing
     * the local edits is the smaller harm, so that is the one chosen.
     */
    writeSnapshot(SITE, { doc: doc("stale"), revision: 7, savedAt: Date.now() });

    expect(readSnapshot(SITE, 9)).toBeNull();
    // And it is gone, so it cannot be offered again on the next load.
    expect(localStorage.getItem(`bh:draft:${SITE}`)).toBeNull();
  });

  it("forgets a snapshot older than a day", () => {
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    writeSnapshot(SITE, { doc: doc("ancient"), revision: 3, savedAt: yesterday });

    expect(readSnapshot(SITE, 3)).toBeNull();
  });

  it("keeps one shop's snapshot out of another's", () => {
    writeSnapshot(SITE, { doc: doc("thread"), revision: 1, savedAt: Date.now() });

    expect(readSnapshot("kiln-and-clay", 1)).toBeNull();
    expect(readSnapshot(SITE, 1)).not.toBeNull();
  });

  it("survives corrupt storage rather than breaking the editor", () => {
    localStorage.setItem(`bh:draft:${SITE}`, "{not json");
    expect(readSnapshot(SITE, 1)).toBeNull();
    expect(localStorage.getItem(`bh:draft:${SITE}`)).toBeNull();
  });

  it("never throws when storage itself is unavailable", () => {
    /*
     * localStorage throws rather than returning null in a private window and
     * when the quota is full. A draft recovery that breaks the editor is worse
     * than no draft recovery, so every call is wrapped.
     */
    const denied = () => {
      throw new Error("The operation is insecure.");
    };
    vi.stubGlobal("localStorage", {
      getItem: denied,
      setItem: denied,
      removeItem: denied,
      clear: denied,
    });

    expect(() => writeSnapshot(SITE, { doc: doc("x"), revision: 1, savedAt: Date.now() })).not.toThrow();
    expect(() => clearSnapshot(SITE)).not.toThrow();
    expect(readSnapshot(SITE, 1)).toBeNull();
  });

  it("clears once the server has the same document", () => {
    writeSnapshot(SITE, { doc: doc("pending"), revision: 4, savedAt: Date.now() });
    clearSnapshot(SITE);
    expect(readSnapshot(SITE, 4)).toBeNull();
  });
});
