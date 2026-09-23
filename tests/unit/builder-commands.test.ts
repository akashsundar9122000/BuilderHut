import { describe, expect, it } from "vitest";
import { applyCommand, coalesceKey, insertableRange } from "@/lib/builder/commands";
import { SiteDocumentSchema, type SiteDocument } from "@/lib/schema/page";
import { buildDocument } from "@/lib/templates";

const base = (): SiteDocument =>
  buildDocument("thread", { storeName: "Thread & Bloom", tagline: "Made slowly", industry: "crochet" });

const homeOf = (doc: SiteDocument) => doc.pages.find((p) => p.system === "home")!;

describe("applyCommand", () => {
  it("does not mutate the document it is given", () => {
    const doc = base();
    const before = JSON.stringify(doc);
    applyCommand(doc, { type: "setSetting", key: "storeName", value: "Changed" });
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("always produces a document that still validates", () => {
    let doc = base();
    const home = homeOf(doc).id;
    doc = applyCommand(doc, { type: "addSection", pageId: home, index: 2, sectionType: "faq" });
    doc = applyCommand(doc, { type: "setTheme", group: "shape", key: "radius", value: 0 });
    doc = applyCommand(doc, { type: "setSetting", key: "tagline", value: "New words" });
    expect(() => SiteDocumentSchema.parse(doc)).not.toThrow();
  });

  it("gives a new section the defaults from its own schema", () => {
    const doc = base();
    const home = homeOf(doc).id;
    const next = applyCommand(doc, { type: "addSection", pageId: home, index: 2, sectionType: "faq" });
    const added = homeOf(next).sections[2]!;
    expect(added.type).toBe("faq");
    expect(added.props.heading).toBe("Questions");
    expect(added.visible).toBe(true);
  });

  it("gives duplicated sections a fresh id and an independent copy of the props", () => {
    const doc = base();
    const home = homeOf(doc).id;
    const heroId = homeOf(doc).sections.find((s) => s.type === "hero")!.id;
    const next = applyCommand(doc, { type: "duplicateSection", pageId: home, sectionId: heroId });

    const heroes = homeOf(next).sections.filter((s) => s.type === "hero");
    expect(heroes).toHaveLength(2);
    expect(heroes[0]!.id).not.toBe(heroes[1]!.id);
    // A shallow copy would make editing the duplicate change the original.
    expect(heroes[1]!.props).not.toBe(heroes[0]!.props);
  });
});

describe("structural sections are protected", () => {
  /*
   * A page without a header has no navigation and no cart; without a footer it
   * has no policy links. Both are reachable through the inspector rather than
   * by deletion, so these are guarded in the command layer — not only in the UI,
   * which is only ever one code path.
   */
  it("refuses to delete the header or the footer", () => {
    const doc = base();
    const home = homeOf(doc);
    for (const type of ["header", "footer"] as const) {
      const id = home.sections.find((s) => s.type === type)!.id;
      const next = applyCommand(doc, { type: "removeSection", pageId: home.id, sectionId: id });
      expect(homeOf(next).sections.some((s) => s.id === id), type).toBe(true);
    }
  });

  it("refuses to duplicate the header or the footer", () => {
    const doc = base();
    const home = homeOf(doc);
    const id = home.sections.find((s) => s.type === "header")!.id;
    const next = applyCommand(doc, { type: "duplicateSection", pageId: home.id, sectionId: id });
    expect(homeOf(next).sections.filter((s) => s.type === "header")).toHaveLength(1);
  });

  it("keeps the header first and the footer last however a section is dragged", () => {
    const doc = base();
    const home = homeOf(doc);
    const { min, max } = insertableRange(home);
    expect(min).toBe(1);
    expect(max).toBe(home.sections.length - 1);

    // Try to drag the hero above the header.
    const next = applyCommand(doc, { type: "moveSection", pageId: home.id, from: 1, to: 0 });
    expect(homeOf(next).sections[0]!.type).toBe("header");

    // And to drop one below the footer.
    const after = applyCommand(doc, { type: "moveSection", pageId: home.id, from: 1, to: 99 });
    expect(homeOf(after).sections.at(-1)!.type).toBe("footer");
  });

  it("refuses to add a section above the header", () => {
    const doc = base();
    const home = homeOf(doc);
    const next = applyCommand(doc, { type: "addSection", pageId: home.id, index: 0, sectionType: "faq" });
    expect(homeOf(next).sections[0]!.type).toBe("header");
  });

  it("ignores a section type that is not in the registry", () => {
    const doc = base();
    const home = homeOf(doc);
    const before = homeOf(doc).sections.length;
    const next = applyCommand(doc, {
      type: "addSection",
      pageId: home.id,
      index: 2,
      // A type name from a browser is a key into the render registry.
      sectionType: "script" as never,
    });
    expect(homeOf(next).sections).toHaveLength(before);
  });
});

describe("reordering", () => {
  it("moves a section and keeps every other one", () => {
    const doc = base();
    const home = homeOf(doc);
    const order = home.sections.map((s) => s.id);
    const next = applyCommand(doc, { type: "moveSection", pageId: home.id, from: 1, to: 3 });
    const moved = homeOf(next).sections.map((s) => s.id);

    expect(moved).toHaveLength(order.length);
    expect(new Set(moved)).toEqual(new Set(order));
    expect(moved[3]).toBe(order[1]);
  });
});

describe("coalescing", () => {
  it("merges repeated edits to the same field into one undo step", () => {
    const a = coalesceKey({ type: "setSectionProp", pageId: "home", sectionId: "hero-1", prop: "heading", value: "A" });
    const b = coalesceKey({ type: "setSectionProp", pageId: "home", sectionId: "hero-1", prop: "heading", value: "Ab" });
    expect(a).toBe(b);
  });

  it("keeps edits to different fields separate", () => {
    const a = coalesceKey({ type: "setSectionProp", pageId: "home", sectionId: "hero-1", prop: "heading", value: "A" });
    const b = coalesceKey({ type: "setSectionProp", pageId: "home", sectionId: "hero-1", prop: "body", value: "A" });
    expect(a).not.toBe(b);
  });

  it("never merges structural changes", () => {
    // Dragging twice must be two undo steps; merging them would make the first
    // drag unrecoverable.
    expect(coalesceKey({ type: "moveSection", pageId: "home", from: 1, to: 2 })).toBeNull();
    expect(coalesceKey({ type: "removeSection", pageId: "home", sectionId: "x" })).toBeNull();
  });
});
