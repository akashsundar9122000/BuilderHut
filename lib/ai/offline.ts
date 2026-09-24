import { propLabel, themeLabel } from "@/lib/render/labels";
import { REGISTRY } from "@/lib/render/registry";
import type { Page, Section, SectionType, SiteDocument } from "@/lib/schema/page";
import type { AiOp, AiPlan } from "./ops";

/*
 * The assistant that needs no network.
 *
 * This is not a placeholder for the model. It is the backend that answers when
 * no model is configured, when the model call fails, and in every test — so it
 * is written to be genuinely useful for the instructions merchants actually
 * type, and to say plainly when it has not understood rather than guessing.
 *
 * It reads the instruction, not the document's meaning: it matches intents and
 * targets. That is a real limit and the UI says so. What it does have over a
 * model is that it is deterministic, instant, free, and cannot invent a section
 * id — every op it emits is built from a section that is actually on the page.
 */

const COLOR_WORDS: Record<string, string> = {
  red: "#b3352c", crimson: "#a3243a", maroon: "#7a2233",
  orange: "#c05a22", amber: "#b3780f", gold: "#a8811d", yellow: "#b08900",
  green: "#2c7a52", emerald: "#1f7a5c", olive: "#6b7233", mint: "#4d9c83",
  teal: "#1f7a7a", cyan: "#177f91", blue: "#2a5fc8", navy: "#1e3a6e",
  indigo: "#4338a8", purple: "#6b3fa0", violet: "#6d43b8", lavender: "#8a6bc4",
  pink: "#b8447a", rose: "#b34063", magenta: "#a8358f",
  brown: "#6f4a32", tan: "#9b7a52", beige: "#c4a888", cream: "#f7f1e6",
  black: "#141414", charcoal: "#2b2b2b", grey: "#6b6b6b", gray: "#6b6b6b",
  silver: "#a8a8a8", white: "#ffffff",
};

/** Words a merchant uses for a section, beyond the registry's own label. */
const SECTION_WORDS: Partial<Record<SectionType, string[]>> = {
  hero: ["hero", "banner at the top", "top banner", "main banner", "headline"],
  productGrid: ["product", "products", "grid", "catalogue", "catalog", "shop section", "items"],
  featureList: ["feature", "features", "benefits", "why", "usp"],
  richText: ["text", "paragraph", "story", "about section", "copy block"],
  imageBanner: ["image banner", "picture banner", "photo banner", "split image"],
  gallery: ["gallery", "photos", "pictures", "images"],
  testimonials: ["testimonial", "testimonials", "reviews", "quotes", "what people said"],
  faq: ["faq", "faqs", "questions", "q&a"],
  newsletter: ["newsletter", "signup", "sign up", "email list", "subscribe"],
  contact: ["contact", "get in touch", "enquiry", "enquiries", "message form"],
  header: ["header", "nav", "navigation", "menu", "top bar"],
  footer: ["footer", "bottom"],
};

function labelWords(type: SectionType): string[] {
  return [REGISTRY[type].label.toLowerCase(), ...(SECTION_WORDS[type] ?? [])];
}

/** The section on this page the instruction is most plausibly about. */
function findSection(page: Page, text: string): Section | null {
  let best: { section: Section; score: number } | null = null;
  for (const section of page.sections) {
    for (const word of labelWords(section.type)) {
      if (!text.includes(word)) continue;
      // Longer matches win: "product grid" beats "grid", "image banner" beats "banner".
      const score = word.length;
      if (!best || score > best.score) best = { section, score };
    }
  }
  return best?.section ?? null;
}

/**
 * The section type the instruction asks to add.
 *
 * `page` so a section tied to one system page is not matched anywhere else:
 * "add a sign in" on the home page would otherwise compile a command that
 * applyCommand then refuses, and the assistant would report having done it.
 */
function findType(text: string, page?: Page): SectionType | null {
  let best: { type: SectionType; score: number } | null = null;
  for (const type of Object.keys(REGISTRY) as SectionType[]) {
    if (type === "header" || type === "footer") continue; // never added, never removed
    const entry = REGISTRY[type];
    if (entry.onlyOn && page?.system !== entry.onlyOn) continue;
    if (entry.essential && page?.sections.some((section) => section.type === type)) continue;
    for (const word of labelWords(type)) {
      if (!text.includes(word)) continue;
      if (!best || word.length > best.score) best = { type, score: word.length };
    }
  }
  return best?.type ?? null;
}

function hexIn(text: string): string | null {
  const match = /#([0-9a-f]{3}|[0-9a-f]{6})\b/i.exec(text);
  return match ? match[0] : null;
}

function colorIn(text: string): string | null {
  const hex = hexIn(text);
  if (hex) return hex;
  for (const [word, value] of Object.entries(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return value;
  }
  return null;
}

/** Text inside quotes — how people give copy: set the heading to "Made slowly". */
function quoted(text: string): string | null {
  const match = /["“'‘]([^"”'’]{2,200})["”'’]/.exec(text);
  if (match) return match[1]!.trim();
  const to = /\bto\s+(.{2,200})$/i.exec(text.trim());
  return to ? to[1]!.trim().replace(/[.!]$/, "") : null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Turn an instruction into a plan.
 *
 * Every branch appends to one op list, so "make the buttons green and round
 * the corners" produces both rather than only the first thing matched.
 */
export function offlinePlan(doc: SiteDocument, pageId: string, instruction: string): AiPlan {
  const page = doc.pages.find((p) => p.id === pageId) ?? doc.pages[0]!;
  const text = instruction.toLowerCase().trim();
  const ops: AiOp[] = [];
  const said: string[] = [];

  const theme = doc.theme;
  const color = colorIn(text);
  const target = findSection(page, text);

  // ── copy ────────────────────────────────────────────────────────────────
  const copyProp = /\bsub[- ]?head|subtitle|\bbody\b|description/.test(text)
    ? "body"
    : /\beyebrow\b|kicker/.test(text)
      ? "eyebrow"
      : /\bheading\b|\btitle\b|\bheadline\b/.test(text)
        ? "heading"
        : /\bbutton\b.*\b(label|text|say)\b|\bcta\b/.test(text)
          ? "ctaLabel"
          : null;

  if (copyProp && target) {
    const value = quoted(instruction);
    if (value) {
      ops.push({ op: "setProp", sectionId: target.id, prop: copyProp, value });
      said.push(`rewrote the ${REGISTRY[target.type].label} ${propLabel(target.type, copyProp)}`);
    }
  }

  // ── colour ──────────────────────────────────────────────────────────────
  if (color) {
    const key = /\bbackground|\bpage colour|\bpage color|\bcanvas\b/.test(text)
      ? "background"
      : /\btext\b|\bink\b|\bfont colour|\bfont color/.test(text)
        ? "text"
        : /\baccent\b|\bsecondary\b|\bhighlight\b/.test(text)
          ? "accent"
          : /\bborder\b/.test(text)
            ? "border"
            : "primary"; // "make the buttons green" is the overwhelmingly common ask
    ops.push({ op: "setTheme", group: "colors", key, value: color });
    said.push(`set ${themeLabel("colors", key).toLowerCase()} to ${color}`);
  }

  // ── shape ───────────────────────────────────────────────────────────────
  if (/\brounder\b|more round|round(ed)?(\s+\w+){0,2}\s+corners?|softer corners?/.test(text)) {
    ops.push({ op: "setTheme", group: "shape", key: "radius", value: clamp(theme.shape.radius + 8, 0, 32) });
    ops.push({ op: "setTheme", group: "shape", key: "buttonRadius", value: clamp(theme.shape.buttonRadius + 8, 0, 999) });
    said.push("rounded the corners");
  } else if (/\bsharp(er)?(\s+\w+){0,2}\s+corners?|square corners?|less round|no round/.test(text)) {
    ops.push({ op: "setTheme", group: "shape", key: "radius", value: 0 });
    ops.push({ op: "setTheme", group: "shape", key: "buttonRadius", value: 0 });
    said.push("squared the corners");
  }

  if (/\bmore (space|spacing|room|breathing)|\bairier\b|\bspaced out|less cramped|open (it |them |the )?up|open up the (space|spacing)/.test(text)) {
    ops.push({ op: "setTheme", group: "shape", key: "sectionSpacing", value: clamp(theme.shape.sectionSpacing + 24, 32, 200) });
    said.push("opened up the spacing");
  } else if (/\btighter|less space|less spacing|more compact|condense/.test(text)) {
    ops.push({ op: "setTheme", group: "shape", key: "sectionSpacing", value: clamp(theme.shape.sectionSpacing - 24, 32, 200) });
    said.push("tightened the spacing");
  }

  // ── type ────────────────────────────────────────────────────────────────
  if (/\bbigger|larger|increase the (text|type|font)|scale up/.test(text)) {
    ops.push({ op: "setTheme", group: "typography", key: "scale", value: round2(clamp(theme.typography.scale + 0.1, 0.8, 1.4)) });
    said.push("increased the type scale");
  } else if (/\bsmaller|reduce the (text|type|font)|scale down/.test(text)) {
    ops.push({ op: "setTheme", group: "typography", key: "scale", value: round2(clamp(theme.typography.scale - 0.1, 0.8, 1.4)) });
    said.push("reduced the type scale");
  }

  if (/\bbolder|heavier|thicker (type|headings?)/.test(text)) {
    const next = theme.typography.headingWeight >= 700 ? 700 : theme.typography.headingWeight === 400 ? 600 : 700;
    ops.push({ op: "setTheme", group: "typography", key: "headingWeight", value: next });
    said.push("made the headings heavier");
  } else if (/\blighter (type|headings?)|thinner (type|headings?)/.test(text)) {
    ops.push({ op: "setTheme", group: "typography", key: "headingWeight", value: 400 });
    said.push("made the headings lighter");
  }

  if (/\buppercase|all caps|capitals/.test(text)) {
    ops.push({ op: "setTheme", group: "typography", key: "headingTransform", value: "uppercase" });
    said.push("set the headings in capitals");
  } else if (/\bsentence case|normal case|not uppercase|lowercase/.test(text)) {
    ops.push({ op: "setTheme", group: "typography", key: "headingTransform", value: "none" });
    said.push("returned the headings to sentence case");
  }

  if (/\bserif\b/.test(text) && !/\bsans[- ]serif\b/.test(text)) {
    ops.push({ op: "setTheme", group: "typography", key: "heading", value: "fraunces" });
    said.push("moved the headings to a serif");
  } else if (/\bsans[- ]?serif\b|\bgrotesque\b|\bmodern (type|font)/.test(text)) {
    ops.push({ op: "setTheme", group: "typography", key: "heading", value: "archivo" });
    said.push("moved the headings to a sans-serif");
  }

  // ── structure ───────────────────────────────────────────────────────────
  if (/\b(add|insert|include|put in|create)\b/.test(text)) {
    const type = findType(text, page);
    if (type) {
      const last = [...page.sections].reverse().find((s) => !s.locked);
      ops.push({ op: "addSection", sectionType: type, afterSectionId: last?.id ?? null });
      said.push(`added a ${REGISTRY[type].label} section`);
    }
  }

  if (target && /\b(hide|remove|delete|drop|get rid of)\b|\btake\b(\s+\w+){0,3}\s+(out|off)\b/.test(text)) {
    // Hiding is reversible and deleting is not, so an ambiguous instruction
    // gets the reversible one. The merchant can still delete it themselves.
    const destructive = /\b(delete|remove permanently|get rid of)\b/.test(text) && !target.locked;
    ops.push(
      destructive
        ? { op: "removeSection", sectionId: target.id }
        : { op: "setVisible", sectionId: target.id, visible: false },
    );
    said.push(`${destructive ? "deleted" : "hid"} the ${REGISTRY[target.type].label}`);
  } else if (target && /\b(show|unhide|bring back|reveal)\b/.test(text)) {
    ops.push({ op: "setVisible", sectionId: target.id, visible: true });
    said.push(`showed the ${REGISTRY[target.type].label}`);
  }

  if (target && /\bmove\b|\bbring\b|\bput\b/.test(text) && /\b(up|higher|top|above|first)\b/.test(text)) {
    const at = page.sections.findIndex((s) => s.id === target.id);
    const anchor = page.sections[at - 2];
    ops.push({ op: "moveSection", sectionId: target.id, afterSectionId: anchor?.id ?? null });
    said.push(`moved the ${REGISTRY[target.type].label} up`);
  } else if (target && /\bmove\b|\bpush\b/.test(text) && /\b(down|lower|bottom|below|last|end)\b/.test(text)) {
    const at = page.sections.findIndex((s) => s.id === target.id);
    const anchor = page.sections[at + 1];
    ops.push({ op: "moveSection", sectionId: target.id, afterSectionId: anchor?.id ?? null });
    said.push(`moved the ${REGISTRY[target.type].label} down`);
  }

  if (ops.length === 0) {
    return {
      summary:
        "I didn't follow that one. Try naming a section and what to change — \"make the buttons green\", \"add an FAQ\", \"hide the newsletter\", or \"set the hero heading to 'Made slowly'\".",
      ops: [],
    };
  }

  const list =
    said.length === 1
      ? said[0]!
      : `${said.slice(0, -1).join(", ")} and ${said.at(-1)}`;
  return { summary: `${list.charAt(0).toUpperCase()}${list.slice(1)}.`, ops };
}
