import { z } from "zod";

import { applyCommand, insertableRange, type Command } from "@/lib/builder/commands";
import { isMutableSection, REGISTRY } from "@/lib/render/registry";
import {
  SECTION_TYPES,
  SectionTypeSchema,
  SiteDocumentSchema,
  type Page,
  type SiteDocument,
} from "@/lib/schema/page";
import {
  describePropValue,
  describeThemeValue,
  propLabel,
  themeLabel,
} from "@/lib/render/labels";
import { ThemeSchema } from "@/lib/schema/theme";

/*
 * What the assistant is allowed to do.
 *
 * Blueprint section 64 is the rule this file enforces: a model never writes
 * markup, CSS or code into a storefront. It proposes operations from a closed
 * list, each one is checked against the same schemas the editor's own controls
 * are checked against, and what survives is compiled into ordinary builder
 * commands — the identical path a click takes, so undo, autosave and history
 * work on an AI edit exactly as they do on a manual one.
 *
 * Three gates, in order:
 *   1. the op parses as one of the shapes below,
 *   2. its target exists, is editable, and its value satisfies that section's
 *      own props schema (or the theme schema),
 *   3. the document that results parses as a whole.
 *
 * An op that fails any gate is dropped with a reason the merchant can read.
 * A partly-valid plan still applies the valid part rather than being thrown
 * away, because a good suggestion should not be lost to a bad one beside it.
 */

export const AiOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("setProp"),
    sectionId: z.string().min(1).max(80),
    prop: z.string().min(1).max(40),
    value: z.unknown(),
  }),
  z.object({
    op: z.literal("addSection"),
    sectionType: SectionTypeSchema,
    /** Insert directly after this section. Omitted means "at the end". */
    afterSectionId: z.string().min(1).max(80).nullish(),
  }),
  z.object({ op: z.literal("removeSection"), sectionId: z.string().min(1).max(80) }),
  z.object({
    op: z.literal("moveSection"),
    sectionId: z.string().min(1).max(80),
    afterSectionId: z.string().min(1).max(80).nullish(),
  }),
  z.object({
    op: z.literal("setVisible"),
    sectionId: z.string().min(1).max(80),
    visible: z.boolean(),
  }),
  z.object({
    op: z.literal("setTheme"),
    group: z.enum(["colors", "typography", "shape"]),
    key: z.string().min(1).max(40),
    value: z.unknown(),
  }),
]);

export type AiOp = z.infer<typeof AiOpSchema>;

export const AiPlanSchema = z.object({
  /** One sentence the merchant reads before deciding. Not a restatement of the ops. */
  summary: z.string().min(1).max(400),
  ops: z.array(AiOpSchema).max(24),
});

export type AiPlan = z.infer<typeof AiPlanSchema>;

export interface CompiledChange {
  command: Command;
  /** Plain English, shown in the review list. */
  label: string;
}

export interface RejectedOp {
  op: AiOp;
  reason: string;
}

export interface CompiledPlan {
  summary: string;
  changes: CompiledChange[];
  rejected: RejectedOp[];
  /** The document if every accepted change is applied. Always valid. */
  result: SiteDocument;
}

/**
 * The setting names a section actually has.
 *
 * Every registry entry is a Zod object, but the entries are typed as the wider
 * `ZodType` so the registry can hold them in one map. Null means "this schema
 * does not expose a shape" — the caller then leaves the decision to the parse
 * rather than rejecting every prop on a schema it could not introspect.
 */
function knownProps(schema: z.ZodType): Set<string> | null {
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  return shape && typeof shape === "object" ? new Set(Object.keys(shape)) : null;
}

function sectionLabel(page: Page, sectionId: string): string {
  const section = page.sections.find((s) => s.id === sectionId);
  return section ? REGISTRY[section.type].label : sectionId;
}

function truncate(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return "nothing";
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/**
 * Check one op against the current document and turn it into a command.
 *
 * Returns a reason instead when the op cannot be honoured. The reasons are
 * written to be shown to a merchant, not logged for a developer — "there is no
 * section called hero-9 on this page" is actionable; "invalid target" is not.
 */
function compileOne(doc: SiteDocument, page: Page, op: AiOp): CompiledChange | string {
  switch (op.op) {
    case "setProp": {
      const section = page.sections.find((s) => s.id === op.sectionId);
      if (!section) return `There is no section called ${op.sectionId} on this page.`;

      const entry = REGISTRY[section.type];
      const candidate = { ...section.props, [op.prop]: op.value };
      // A prop the section does not have is the common model mistake, and it
      // deserves a different sentence from a prop with an unusable value.
      const allowed = knownProps(entry.schema);
      if (allowed && !allowed.has(op.prop)) {
        return `${entry.label} has no setting called ${op.prop}.`;
      }

      const parsed = entry.schema.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return `The ${entry.label}'s ${propLabel(section.type, op.prop)} could not be set to ${truncate(op.value)} — ${issue?.message ?? "it is not a valid value"}.`;
      }

      return {
        command: {
          type: "setSectionProp",
          pageId: page.id,
          sectionId: op.sectionId,
          prop: op.prop,
          value: op.value,
        },
        label: `${entry.label}: ${propLabel(section.type, op.prop)} \u2192 ${truncate(describePropValue(section.type, op.prop, op.value))}`,
      };
    }

    case "addSection": {
      if (!SECTION_TYPES.includes(op.sectionType)) {
        return `${op.sectionType} is not a section BuilderHut can render.`;
      }
      const entry = REGISTRY[op.sectionType];
      /*
       * The same two rules applyCommand enforces. Without them the command would
       * be compiled, refused silently on apply, and reported back as done — an
       * assistant claiming it added a sign-in form to the home page.
       */
      if (entry.onlyOn && page.system !== entry.onlyOn) {
        return `A ${entry.label} only belongs on the ${entry.onlyOn} page.`;
      }
      if (entry.essential && page.sections.some((s) => s.type === op.sectionType)) {
        return `This page already has a ${entry.label}.`;
      }

      const range = insertableRange(page);
      let index = range.max;
      if (op.afterSectionId) {
        const at = page.sections.findIndex((s) => s.id === op.afterSectionId);
        if (at === -1) return `There is no section called ${op.afterSectionId} to put it after.`;
        index = Math.min(Math.max(at + 1, range.min), range.max);
      }
      return {
        command: { type: "addSection", pageId: page.id, index, sectionType: op.sectionType },
        label: `Add a ${REGISTRY[op.sectionType].label} section`,
      };
    }

    case "removeSection": {
      const section = page.sections.find((s) => s.id === op.sectionId);
      if (!section) return `There is no section called ${op.sectionId} on this page.`;
      // The header and footer are locked for the same reason a page cannot
      // delete its own navigation. An assistant does not get an exception.
      if (section.locked) return `The ${REGISTRY[section.type].label} is locked and cannot be removed.`;
      // And a sign-in form is the reason its page exists at all.
      if (!isMutableSection(section.type)) {
        return `The ${REGISTRY[section.type].label} is what this page is for, so it can't be removed.`;
      }
      return {
        command: { type: "removeSection", pageId: page.id, sectionId: op.sectionId },
        label: `Delete the ${REGISTRY[section.type].label} section`,
      };
    }

    case "moveSection": {
      const from = page.sections.findIndex((s) => s.id === op.sectionId);
      if (from === -1) return `There is no section called ${op.sectionId} on this page.`;
      if (page.sections[from]!.locked) {
        return `The ${sectionLabel(page, op.sectionId)} is locked and cannot be moved.`;
      }
      const range = insertableRange(page);
      let to = range.max - 1;
      if (op.afterSectionId) {
        const anchor = page.sections.findIndex((s) => s.id === op.afterSectionId);
        if (anchor === -1) return `There is no section called ${op.afterSectionId} to move it after.`;
        to = anchor;
      }
      to = Math.min(Math.max(to, range.min), range.max - 1);
      if (to === from) return `The ${sectionLabel(page, op.sectionId)} is already there.`;
      return {
        command: { type: "moveSection", pageId: page.id, from, to },
        label: `Move the ${sectionLabel(page, op.sectionId)} ${to > from ? "down" : "up"}`,
      };
    }

    case "setVisible": {
      const section = page.sections.find((s) => s.id === op.sectionId);
      if (!section) return `There is no section called ${op.sectionId} on this page.`;
      if (section.visible === op.visible) {
        return `The ${REGISTRY[section.type].label} is already ${op.visible ? "visible" : "hidden"}.`;
      }
      return {
        command: { type: "toggleSectionVisible", pageId: page.id, sectionId: op.sectionId },
        label: `${op.visible ? "Show" : "Hide"} the ${REGISTRY[section.type].label}`,
      };
    }

    case "setTheme": {
      const group = ThemeSchema.shape[op.group];
      const candidate = { ...doc.theme[op.group], [op.key]: op.value };
      const parsed = group.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return `${themeLabel(op.group, op.key)} could not be set to ${truncate(op.value)} — ${issue?.message ?? "it is not a valid value"}.`;
      }
      return {
        command: { type: "setTheme", group: op.group, key: op.key, value: op.value },
        label: `${themeLabel(op.group, op.key)} \u2192 ${describeThemeValue(op.group, op.key, op.value)}`,
      };
    }
  }
}

/**
 * Compile a proposed plan against a document.
 *
 * Each op is checked against the document as it stands *after* the ops before
 * it, so "add a FAQ, then set its heading" is coherent rather than validated
 * against a document that no longer exists by the time it runs.
 */
export function compilePlan(doc: SiteDocument, pageId: string, plan: AiPlan): CompiledPlan {
  const changes: CompiledChange[] = [];
  const rejected: RejectedOp[] = [];
  let working = doc;

  for (const op of plan.ops) {
    const page = working.pages.find((p) => p.id === pageId);
    if (!page) {
      rejected.push({ op, reason: "That page is no longer open." });
      continue;
    }

    const compiled = compileOne(working, page, op);
    if (typeof compiled === "string") {
      rejected.push({ op, reason: compiled });
      continue;
    }

    const next = applyCommand(working, compiled.command);
    if (next === working) {
      rejected.push({ op, reason: "That change would not have altered anything." });
      continue;
    }

    /*
     * The last gate. A command that individually looked fine but produces a
     * document the schema rejects is dropped here rather than being written —
     * the draft is what the live storefront is published from, and it is never
     * allowed to hold something the renderer cannot read.
     */
    const validated = SiteDocumentSchema.safeParse(next);
    if (!validated.success) {
      rejected.push({ op, reason: "That change would have left the page in a state we can't save." });
      continue;
    }

    working = validated.data;
    changes.push(compiled);
  }

  return { summary: plan.summary, changes, rejected, result: working };
}

/**
 * A compact description of the page, for the model to reason about.
 *
 * Deliberately not the whole document: props are summarised to their text so a
 * long page does not push the instruction out of the context window, and no
 * customer or order data is anywhere near this.
 */
export function describeDocument(doc: SiteDocument, pageId: string): string {
  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]!;
  const lines = page.sections.map((section) => {
    const entry = REGISTRY[section.type];
    const props = Object.entries(section.props)
      .filter(([, v]) => typeof v === "string" && v.length > 0)
      .slice(0, 4)
      .map(([k, v]) => `${k}=${JSON.stringify(truncate(v))}`)
      .join(" ");
    const flags = [section.visible ? null : "hidden", section.locked ? "locked" : null]
      .filter(Boolean)
      .join(",");
    return `- ${section.id} (${entry.label}${flags ? `, ${flags}` : ""})${props ? ` ${props}` : ""}`;
  });

  return [
    `Store: ${doc.settings.storeName}`,
    `Page: ${page.title} (${page.slug || "home"})`,
    `Theme colours: ${Object.entries(doc.theme.colors).map(([k, v]) => `${k}=${v}`).join(" ")}`,
    `Theme type: heading=${doc.theme.typography.heading} body=${doc.theme.typography.body} scale=${doc.theme.typography.scale}`,
    `Theme shape: radius=${doc.theme.shape.radius} buttonRadius=${doc.theme.shape.buttonRadius} sectionSpacing=${doc.theme.shape.sectionSpacing}`,
    "Sections, in order:",
    ...lines,
  ].join("\n");
}
