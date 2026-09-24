import { SECTION_TYPES, type Page, type Section, type SiteDocument, type SectionType } from "@/lib/schema/page";
import { defaultPropsFor, isMutableSection, REGISTRY } from "@/lib/render/registry";

/*
 * Every edit the builder can make, as data.
 *
 * Commands rather than direct mutation, for three reasons that all arrive
 * later: the same shapes are what the AI assistant will emit (validated
 * structured ops, never generated code), what an autosave delta can carry
 * instead of the whole document, and what a "what changed since I published"
 * view would read.
 *
 * Applying a command is pure — document in, document out — so history is just
 * the sequence of resulting documents. Blueprint section 6.7 asks for commands
 * over blind snapshots, and this is the honest reading of that: the COMMAND is
 * the unit of change and of undo, and a text edit coalesces into one entry
 * rather than one per keystroke. Deriving an inverse for every command would be
 * more machinery and more places to be subtly wrong, for a document that is a
 * few hundred kilobytes at most.
 */

export type Command =
  | { type: "setSectionProp"; pageId: string; sectionId: string; prop: string; value: unknown }
  | { type: "moveSection"; pageId: string; from: number; to: number }
  | {
      type: "addSection";
      pageId: string;
      index: number;
      sectionType: SectionType;
      /** Chosen by the caller when it needs to select the result. Generated if absent. */
      sectionId?: string;
    }
  | { type: "removeSection"; pageId: string; sectionId: string }
  | { type: "duplicateSection"; pageId: string; sectionId: string }
  | { type: "toggleSectionVisible"; pageId: string; sectionId: string }
  | { type: "toggleSectionLocked"; pageId: string; sectionId: string }
  | { type: "setTheme"; group: "colors" | "typography" | "shape"; key: string; value: unknown }
  | { type: "setSetting"; key: string; value: unknown }
  | { type: "setSocial"; key: string; value: string }
  | { type: "setPageSeo"; pageId: string; key: string; value: unknown };

/** A short, human label. Shown in history and in the undo toast. */
export function describeCommand(command: Command): string {
  switch (command.type) {
    case "setSectionProp": return `Edit ${command.prop}`;
    case "moveSection": return "Reorder sections";
    case "addSection": return `Add ${command.sectionType}`;
    case "removeSection": return "Delete section";
    case "duplicateSection": return "Duplicate section";
    case "toggleSectionVisible": return "Show or hide section";
    case "toggleSectionLocked": return "Lock or unlock section";
    case "setTheme": return `Change ${command.key}`;
    case "setSetting": return `Change ${command.key}`;
    case "setSocial": return `Change ${command.key}`;
    case "setPageSeo": return "Edit SEO";
  }
}

/**
 * Commands that should merge with the previous one when they touch the same
 * target in quick succession — otherwise typing a heading is forty undo steps.
 */
export function coalesceKey(command: Command): string | null {
  switch (command.type) {
    case "setSectionProp": return `prop:${command.pageId}:${command.sectionId}:${command.prop}`;
    case "setTheme": return `theme:${command.group}:${command.key}`;
    case "setSetting": return `setting:${command.key}`;
    case "setSocial": return `social:${command.key}`;
    case "setPageSeo": return `seo:${command.pageId}:${command.key}`;
    default: return null; // structural changes are always their own step
  }
}

function mapPage(doc: SiteDocument, pageId: string, fn: (page: Page) => Page): SiteDocument {
  return { ...doc, pages: doc.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

/**
 * The id a new section of this type would get.
 *
 * Exported because adding a section and then selecting it are two steps, and
 * the second one needs to know what the first produced. Readable and stable:
 * hero-3 rather than a uuid nobody can hold in their head.
 */
export function newSectionId(type: string, existing: Section[]): string {
  let n = 1;
  while (existing.some((s) => s.id === `${type}-${n}`)) n += 1;
  return `${type}-${n}`;
}

/** Where a new section may land: never above the header or below the footer. */
export function insertableRange(page: Page): { min: number; max: number } {
  const min = page.sections[0]?.type === "header" ? 1 : 0;
  const last = page.sections.length;
  const max = page.sections[last - 1]?.type === "footer" ? last - 1 : last;
  return { min, max: Math.max(min, max) };
}

export function applyCommand(doc: SiteDocument, command: Command): SiteDocument {
  switch (command.type) {
    case "setSectionProp":
      return mapPage(doc, command.pageId, (page) => ({
        ...page,
        sections: page.sections.map((s) =>
          s.id === command.sectionId
            ? { ...s, props: { ...s.props, [command.prop]: command.value } }
            : s,
        ),
      }));

    case "moveSection":
      return mapPage(doc, command.pageId, (page) => {
        const { min, max } = insertableRange(page);
        const from = command.from;
        // Structural sections stay put, and nothing may be dropped outside them.
        if (from < min || from >= max) return page;
        const to = Math.min(Math.max(command.to, min), max - 1);
        if (from === to) return page;
        const sections = [...page.sections];
        const [moved] = sections.splice(from, 1);
        sections.splice(to, 0, moved!);
        return { ...page, sections };
      });

    case "addSection":
      return mapPage(doc, command.pageId, (page) => {
        if (!SECTION_TYPES.includes(command.sectionType)) return page;
        const entry = REGISTRY[command.sectionType];
        /*
         * A sign-in form belongs on the sign-in page, and only one of it. The
         * Add panel already filters on both, but a command is a command: it can
         * arrive from the assistant, from an undo of an older document, or from
         * anything else that learns the shape.
         */
        if (entry.onlyOn && page.system !== entry.onlyOn) return page;
        if (entry.essential && page.sections.some((s) => s.type === command.sectionType)) {
          return page;
        }
        const { min, max } = insertableRange(page);
        const index = Math.min(Math.max(command.index, min), max);
        const section: Section = {
          id: command.sectionId ?? newSectionId(command.sectionType, page.sections),
          type: command.sectionType,
          props: defaultPropsFor(command.sectionType),
          visible: true,
          locked: false,
        };
        const sections = [...page.sections];
        sections.splice(index, 0, section);
        return { ...page, sections };
      });

    case "removeSection":
      return mapPage(doc, command.pageId, (page) => {
        const target = page.sections.find((s) => s.id === command.sectionId);
        /*
         * The header and footer are structure rather than content, and a sign-in
         * form is the reason its page exists. Asked of the registry rather than
         * listed here, so a new section of either kind is covered by declaring it
         * and not by remembering to edit three switch cases.
         */
        if (!target || !isMutableSection(target.type)) return page;
        return { ...page, sections: page.sections.filter((s) => s.id !== command.sectionId) };
      });

    case "duplicateSection":
      return mapPage(doc, command.pageId, (page) => {
        const index = page.sections.findIndex((s) => s.id === command.sectionId);
        const target = page.sections[index];
        if (!target || !isMutableSection(target.type)) return page;
        const copy: Section = {
          ...target,
          id: newSectionId(target.type, page.sections),
          props: structuredClone(target.props),
        };
        const sections = [...page.sections];
        sections.splice(index + 1, 0, copy);
        return { ...page, sections };
      });

    case "toggleSectionVisible":
      return mapPage(doc, command.pageId, (page) => {
        /*
         * This had no guard at all, so a command could hide the header even
         * though the layer tree offers no eye for it. Hiding a sign-in form would
         * be the same class of mistake with a worse outcome: a sign-in page with
         * no way to sign in.
         */
        const target = page.sections.find((s) => s.id === command.sectionId);
        if (!target || !isMutableSection(target.type)) return page;
        return {
          ...page,
          sections: page.sections.map((s) =>
            s.id === command.sectionId ? { ...s, visible: !s.visible } : s,
          ),
        };
      });

    case "toggleSectionLocked":
      return mapPage(doc, command.pageId, (page) => ({
        ...page,
        sections: page.sections.map((s) =>
          s.id === command.sectionId ? { ...s, locked: !s.locked } : s,
        ),
      }));

    case "setTheme":
      return {
        ...doc,
        theme: {
          ...doc.theme,
          [command.group]: { ...doc.theme[command.group], [command.key]: command.value },
        },
      };

    case "setSetting":
      return { ...doc, settings: { ...doc.settings, [command.key]: command.value } };

    case "setSocial":
      return {
        ...doc,
        settings: {
          ...doc.settings,
          socials: { ...doc.settings.socials, [command.key]: command.value },
        },
      };

    case "setPageSeo":
      return mapPage(doc, command.pageId, (page) => ({
        ...page,
        seo: { ...page.seo, [command.key]: command.value },
      }));
  }
}
