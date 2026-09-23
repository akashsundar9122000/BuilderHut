import { describe, expect, it } from "vitest";

import { compilePlan, describeDocument, type AiPlan } from "@/lib/ai/ops";
import { offlinePlan } from "@/lib/ai/offline";
import { parsePlan } from "@/lib/ai/provider";
import { SiteDocumentSchema } from "@/lib/schema/page";
import { buildDocument } from "@/lib/templates";

const doc = buildDocument("thread", {
  storeName: "Thread & Bloom",
  tagline: "Made slowly",
  industry: "crochet",
});
const homeId = doc.pages.find((p) => p.system === "home")!.id;
const home = doc.pages.find((p) => p.system === "home")!;

function plan(ops: AiPlan["ops"]): AiPlan {
  return { summary: "test", ops };
}

/*
 * The assistant is the one place in the product where text from a model turns
 * into changes to something a merchant sells from. These tests are the gate,
 * so they are written against what a wrong answer would do, not what a right
 * one does.
 */
describe("compiling an assistant plan", () => {
  it("turns a valid prop change into a command", () => {
    const hero = home.sections.find((s) => s.type === "hero")!;
    const result = compilePlan(doc, homeId, plan([
      { op: "setProp", sectionId: hero.id, prop: "heading", value: "Made slowly" },
    ]));

    expect(result.rejected).toEqual([]);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.command).toMatchObject({ type: "setSectionProp", prop: "heading" });
  });

  it("refuses a section id that is not on the page", () => {
    const result = compilePlan(doc, homeId, plan([
      { op: "setProp", sectionId: "hero-invented", prop: "heading", value: "x" },
    ]));
    expect(result.changes).toEqual([]);
    expect(result.rejected[0]!.reason).toContain("hero-invented");
  });

  it("refuses a prop the section does not have", () => {
    const hero = home.sections.find((s) => s.type === "hero")!;
    const result = compilePlan(doc, homeId, plan([
      { op: "setProp", sectionId: hero.id, prop: "backgroundVideo", value: "https://x/y.mp4" },
    ]));
    expect(result.changes).toEqual([]);
    expect(result.rejected[0]!.reason).toContain("no setting called backgroundVideo");
  });

  it("refuses a value the section's own schema rejects", () => {
    const hero = home.sections.find((s) => s.type === "hero")!;
    const result = compilePlan(doc, homeId, plan([
      { op: "setProp", sectionId: hero.id, prop: "layout", value: "parallax-3d" },
    ]));
    expect(result.changes).toEqual([]);
    expect(result.rejected).toHaveLength(1);
  });

  it("refuses to delete a locked section", () => {
    const header = home.sections.find((s) => s.type === "header")!;
    expect(header.locked).toBe(true);
    const result = compilePlan(doc, homeId, plan([
      { op: "removeSection", sectionId: header.id },
    ]));
    expect(result.changes).toEqual([]);
    expect(result.rejected[0]!.reason).toContain("locked");
  });

  it("refuses to move a locked section", () => {
    const footer = home.sections.find((s) => s.type === "footer")!;
    const result = compilePlan(doc, homeId, plan([
      { op: "moveSection", sectionId: footer.id, afterSectionId: null },
    ]));
    expect(result.changes).toEqual([]);
    expect(result.rejected[0]!.reason).toContain("locked");
  });

  it("refuses a theme value outside the schema's range", () => {
    const result = compilePlan(doc, homeId, plan([
      { op: "setTheme", group: "shape", key: "radius", value: 400 },
      { op: "setTheme", group: "colors", key: "primary", value: "rebeccapurple" },
      { op: "setTheme", group: "typography", key: "heading", value: "Comic Sans" },
    ]));
    expect(result.changes).toEqual([]);
    expect(result.rejected).toHaveLength(3);
  });

  it("keeps the valid ops when one beside them is rejected", () => {
    const hero = home.sections.find((s) => s.type === "hero")!;
    const result = compilePlan(doc, homeId, plan([
      { op: "setProp", sectionId: hero.id, prop: "heading", value: "Kept" },
      { op: "setProp", sectionId: "nope", prop: "heading", value: "Dropped" },
      { op: "setTheme", group: "shape", key: "radius", value: 4 },
    ]));
    expect(result.changes).toHaveLength(2);
    expect(result.rejected).toHaveLength(1);
  });

  it("validates each op against the document the ops before it produced", () => {
    // Add a section, then set a prop on it. The second op refers to a section
    // that does not exist in the document the plan started from.
    const result = compilePlan(doc, homeId, plan([
      { op: "addSection", sectionType: "faq", afterSectionId: null },
      { op: "setProp", sectionId: "faq-1", prop: "heading", value: "Before you buy" },
    ]));
    expect(result.rejected).toEqual([]);
    expect(result.changes).toHaveLength(2);
  });

  it("never inserts above the header or below the footer", () => {
    const result = compilePlan(doc, homeId, plan([
      { op: "addSection", sectionType: "faq", afterSectionId: null },
    ]));
    const page = result.result.pages.find((p) => p.id === homeId)!;
    expect(page.sections[0]!.type).toBe("header");
    expect(page.sections.at(-1)!.type).toBe("footer");
  });

  it("always produces a document that validates", () => {
    const hero = home.sections.find((s) => s.type === "hero")!;
    const result = compilePlan(doc, homeId, plan([
      { op: "setProp", sectionId: hero.id, prop: "heading", value: "x".repeat(50) },
      { op: "addSection", sectionType: "testimonials", afterSectionId: hero.id },
      { op: "setTheme", group: "colors", key: "primary", value: "#123456" },
    ]));
    expect(() => SiteDocumentSchema.parse(result.result)).not.toThrow();
  });

  it("does not spend a change on an op that alters nothing", () => {
    const hero = home.sections.find((s) => s.type === "hero")!;
    const result = compilePlan(doc, homeId, plan([
      { op: "setVisible", sectionId: hero.id, visible: true },
    ]));
    expect(result.changes).toEqual([]);
    expect(result.rejected[0]!.reason).toContain("already");
  });
});

describe("the page description sent to a model", () => {
  const text = describeDocument(doc, homeId);

  it("names every section id, so the model has real ids to use", () => {
    for (const section of home.sections) expect(text).toContain(section.id);
  });

  it("marks locked sections as locked", () => {
    expect(text).toMatch(/locked/);
  });

  it("carries the theme so a colour instruction has something to change", () => {
    expect(text).toContain(doc.theme.colors.primary);
  });
});

describe("parsing what a model returns", () => {
  it("reads a bare JSON object", () => {
    expect(parsePlan('{"summary":"ok","ops":[]}').summary).toBe("ok");
  });

  it("reads JSON inside a markdown fence", () => {
    expect(parsePlan('```json\n{"summary":"ok","ops":[]}\n```').summary).toBe("ok");
  });

  it("reads JSON with prose around it", () => {
    expect(parsePlan('Sure! {"summary":"ok","ops":[]} Hope that helps.').summary).toBe("ok");
  });

  it("refuses an op that is not on the allowlist", () => {
    expect(() =>
      parsePlan('{"summary":"x","ops":[{"op":"runScript","code":"alert(1)"}]}'),
    ).toThrow();
  });

  it("refuses a reply that is not a plan at all", () => {
    expect(() => parsePlan("I'd be happy to help with that!")).toThrow();
  });
});

describe("the offline planner", () => {
  function ask(instruction: string) {
    return compilePlan(doc, homeId, offlinePlan(doc, homeId, instruction));
  }

  it("sets the primary colour from a colour word", () => {
    const result = ask("make the buttons deep green");
    expect(result.changes).toHaveLength(1);
    expect(result.result.theme.colors.primary).not.toBe(doc.theme.colors.primary);
  });

  it("takes a hex code literally", () => {
    const result = ask("set the accent to #123456");
    expect(result.result.theme.colors.accent).toBe("#123456");
  });

  it("does more than one thing when asked for more than one thing", () => {
    const result = ask("round the corners and open up the spacing");
    expect(result.changes.length).toBeGreaterThanOrEqual(3);
    expect(result.result.theme.shape.radius).toBeGreaterThan(doc.theme.shape.radius);
    expect(result.result.theme.shape.sectionSpacing).toBeGreaterThan(doc.theme.shape.sectionSpacing);
  });

  it("adds the section that was named", () => {
    const result = ask("add an FAQ");
    const page = result.result.pages.find((p) => p.id === homeId)!;
    expect(page.sections.some((s) => s.type === "faq")).toBe(true);
  });

  it("hides rather than deletes when the instruction is ambiguous", () => {
    const result = ask("take the contact form off the page");
    const page = result.result.pages.find((p) => p.id === homeId)!;
    const contact = page.sections.find((s) => s.type === "contact");
    // Still there, just not shown — a merchant can put it back with one click.
    expect(contact).toBeDefined();
    expect(contact!.visible).toBe(false);
  });

  it("deletes only when the instruction is unambiguous", () => {
    const result = ask("delete the testimonials section");
    const page = result.result.pages.find((p) => p.id === homeId)!;
    expect(page.sections.some((s) => s.type === "testimonials")).toBe(false);
  });

  it("never touches the header, whatever it is asked", () => {
    for (const instruction of ["delete the header", "remove the navigation", "hide the header"]) {
      const result = ask(instruction);
      const page = result.result.pages.find((p) => p.id === homeId)!;
      const header = page.sections.find((s) => s.type === "header")!;
      expect(header, instruction).toBeDefined();
      // Hiding a header is allowed and reversible; deleting it is not allowed.
      expect(page.sections[0]!.type, instruction).toBe("header");
    }
  });

  it("stays inside the theme schema's bounds however many times it is nudged", () => {
    let current = doc;
    for (let i = 0; i < 12; i += 1) {
      const result = compilePlan(current, homeId, offlinePlan(current, homeId, "make it rounder"));
      current = result.result;
    }
    expect(current.theme.shape.radius).toBeLessThanOrEqual(32);
    expect(() => SiteDocumentSchema.parse(current)).not.toThrow();
  });

  it("says so plainly when it has not understood", () => {
    const result = offlinePlan(doc, homeId, "please make it feel more like a Tuesday");
    expect(result.ops).toEqual([]);
    expect(result.summary).toContain("didn't follow");
  });

  it("proposes nothing that the compiler then has to reject", () => {
    // If the planner emits ops the compiler refuses, the merchant sees warnings
    // for something they never asked to be attempted.
    const instructions = [
      "make the buttons navy",
      "add testimonials",
      "bigger text",
      "uppercase headings",
      "use a serif heading",
      "tighter spacing",
      "sharp corners",
      "hide the customer reviews",
      "move the products up",
    ];
    for (const instruction of instructions) {
      const result = compilePlan(doc, homeId, offlinePlan(doc, homeId, instruction));
      expect(result.rejected, `${instruction}: ${result.rejected[0]?.reason}`).toEqual([]);
    }
  });
});
