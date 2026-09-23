import { INSPECTOR, type Control } from "@/lib/render/inspector";
import type { SectionType } from "@/lib/schema/page";
import { FONT_LABELS, type FontFamily } from "@/lib/schema/theme";

/*
 * The words a merchant sees for the things they can change.
 *
 * One map, because the same setting is named in three places — the inspector's
 * controls, the assistant's list of proposed changes, and the undo history —
 * and a merchant who reads "Button rounding" in one and "buttonRadius" in
 * another has been shown our variable names. These are theirs.
 */

export const THEME_COLOR_LABELS: Record<string, string> = {
  background: "Page",
  surface: "Cards",
  raised: "Tinted bands",
  text: "Text",
  muted: "Quiet text",
  border: "Lines",
  primary: "Buttons",
  onPrimary: "Button text",
  accent: "Highlights",
};

export const THEME_TYPE_LABELS: Record<string, string> = {
  heading: "Heading font",
  body: "Body font",
  scale: "Overall text size",
  headingWeight: "Heading weight",
  headingTracking: "Heading letter spacing",
  headingTransform: "Heading case",
};

export const THEME_SHAPE_LABELS: Record<string, string> = {
  radius: "Corner rounding",
  buttonRadius: "Button rounding",
  sectionSpacing: "Space between sections",
  borderWidth: "Line thickness",
};

export function themeLabel(group: "colors" | "typography" | "shape", key: string): string {
  const map =
    group === "colors"
      ? THEME_COLOR_LABELS
      : group === "typography"
        ? THEME_TYPE_LABELS
        : THEME_SHAPE_LABELS;
  return map[key] ?? key;
}

/**
 * A section setting, in the words its own inspector control uses.
 *
 * The inspector descriptors are the source — they already name every control a
 * merchant can see, per section type, and a second list beside them would drift
 * within a week. The fallbacks below cover props that have no control (a
 * template may set one the inspector does not expose) and, failing that, the
 * schema name split into words.
 */
const FALLBACK_PROP_LABELS: Record<string, string> = {
  heading: "heading",
  body: "body text",
  eyebrow: "the line above the heading",
  ctaLabel: "button label",
  ctaHref: "button link",
  items: "the list of items",
  images: "the images",
};

function findControl(type: SectionType, prop: string): Control | null {
  for (const group of INSPECTOR[type]) {
    for (const control of group.controls) {
      if (control.prop === prop) return control;
    }
  }
  return null;
}

export function propLabel(type: SectionType, prop: string): string {
  const control = findControl(type, prop);
  if (control) return control.label.toLowerCase();
  return (
    FALLBACK_PROP_LABELS[prop] ?? prop.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
  );
}

/** A prop value as its control would show it: "Split", not "split". */
export function describePropValue(type: SectionType, prop: string, value: unknown): string {
  const control = findControl(type, prop);
  if (control?.kind === "select") {
    const option = control.options.find(([optionValue]) => optionValue === value);
    if (option) return option[1];
  }
  if (control?.kind === "toggle") return value ? "on" : "off";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}


/**
 * A theme value in the terms the control for it uses.
 *
 * `buttonRadius: 999` is a slider at its maximum, which means "fully round" —
 * printing the number would invite a merchant to wonder what 999 of anything
 * is. Fonts print their proper names, not their ids.
 */
export function describeThemeValue(
  group: "colors" | "typography" | "shape",
  key: string,
  value: unknown,
): string {
  if (group === "colors") return String(value);

  if (group === "typography") {
    if (key === "heading" || key === "body") {
      return FONT_LABELS[value as FontFamily] ?? String(value);
    }
    if (key === "headingTransform") return value === "uppercase" ? "capitals" : "as typed";
    if (key === "scale") return `${value}×`;
    return String(value);
  }

  if (key === "buttonRadius" && typeof value === "number" && value >= 999) return "fully round";
  if (typeof value === "number") return `${value}px`;
  return String(value);
}
