import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GUIDE_PAGES } from "@/lib/guide/generated";
import { FEATURES, GUIDE_DOORS, PRINCIPLES, QUESTIONS } from "@/lib/marketing/content";

const CSS = readFileSync(
  path.join(process.cwd(), "styles", "marketing.css"),
  "utf8",
);

/*
 * Guards for the marketing surface.
 *
 * Both of the CSS rules below are invisible in review: the page looks correct
 * in the one state the reviewer happens to be in, and is wrong in another.
 */
describe("styles/marketing.css", () => {
  it("uses tokens, never a raw colour", () => {
    /*
     * The house rule. A hex here is a colour that no theme can change and that
     * scripts/check-contrast.ts cannot see, so it will look wrong in exactly
     * one of light, dark and the theatre — and nothing will say so.
     *
     * The mask gradients are the exception: `#000` in a mask is an alpha
     * channel, not a colour, and there is no token for "opaque".
     */
    const offenders = CSS.split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /#[0-9a-fA-F]{3,8}\b/.test(line))
      .filter(([, line]) => !line.includes("mask-image"));

    expect(offenders.map(([n, line]) => `${n}: ${line.trim()}`)).toEqual([]);
  });

  it("puts everything that moves or hides inside the motion scope", () => {
    /*
     * The trap this file exists for, in two forms.
     *
     * The reduced-motion backstop in tokens.css collapses motion with
     * `animation-duration: 1ms !important`. That works on a time-based
     * animation and does NOTHING to a scroll-driven one: once
     * `animation-timeline` is set, duration is ignored outright and progress
     * comes from the scroll position instead. So a scroll-driven effect
     * written outside the scope sails straight through the setting meant to
     * stop it, and the only way to find out is to be someone who needs it.
     *
     * And a hidden-until-revealed state (`opacity: 0`) outside the scope hides
     * content from everyone the reveal never runs for — no JavaScript, reduced
     * motion, an old engine — because the backstop shortens transitions and
     * never un-hides anything.
     *
     * This used to check for `@media (prefers-reduced-motion: no-preference)`.
     * The gate is now `:root[data-motion="full"]`, the resolved answer from
     * lib/motion.ts that also honours the footer's motion control, and the
     * test covers every animation and every hidden state rather than only
     * timelines. Keyframe bodies are exempt: a `from { opacity: 0 }` does
     * nothing until a rule inside the scope names it.
     *
     * Counting braces is crude and entirely sufficient — it is asking one
     * structural question.
     */
    const lines = CSS.split("\n");
    let depth = 0;
    let scopedFrom: number | null = null;
    let keyframesFrom: number | null = null;
    const unguarded: string[] = [];

    lines.forEach((line, index) => {
      if (/^:root\[data-motion="full"\]\s*\{/.test(line) && scopedFrom === null) {
        scopedFrom = depth;
      }
      if (/@keyframes\b/.test(line) && keyframesFrom === null) keyframesFrom = depth;

      const moves = /\banimation(-name|-timeline)?\s*:/.test(line);
      const hides = /\bopacity\s*:\s*0\s*;/.test(line) && keyframesFrom === null;
      if ((moves || hides) && scopedFrom === null) {
        unguarded.push(`${index + 1}: ${line.trim()}`);
      }

      depth += (line.match(/\{/g) ?? []).length;
      depth -= (line.match(/\}/g) ?? []).length;

      if (scopedFrom !== null && depth <= scopedFrom) scopedFrom = null;
      if (keyframesFrom !== null && depth <= keyframesFrom) keyframesFrom = null;
    });

    expect(unguarded).toEqual([]);
  });

  it("does not gate on the OS media query directly", () => {
    // One mechanism. A rule behind `no-preference` would ignore the reader's
    // choice in the footer in both directions, and disagree with the rest.
    expect(CSS).not.toMatch(/@media[^{]*prefers-reduced-motion/);
  });

  it("actually contains the scroll-driven upgrade it is here to hold", () => {
    // Guard on the guard: the two rules above both pass trivially against an
    // empty file, and a stylesheet that lost its @supports block would look
    // green while the page quietly went back to plain fades.
    expect(CSS).toContain("@supports (animation-timeline: view())");
    expect(CSS).toMatch(/animation-timeline:\s*view\(\)/);
    expect(CSS).toMatch(/^:root\[data-motion="full"\]\s*\{/m);
  });
});

describe("landing page content", () => {
  it("links only to guide pages that exist", () => {
    /*
     * `pnpm check:guide` fails the build on a dead /guide link, but only for
     * links it can see in the guide's own markdown. These are in a TypeScript
     * module, so they are checked here instead.
     */
    const known = new Set(GUIDE_PAGES.map((p) => `/guide/${p.group}/${p.slug}`));

    const hrefs = [...GUIDE_DOORS.map((d) => d.href), ...PRINCIPLES.map((p) => p.href)];
    expect(hrefs.filter((href) => !known.has(href))).toEqual([]);
  });

  it("has something in every list the page renders", () => {
    // Each of these drives a grid. An empty one is a section that renders its
    // heading over nothing, which is the kind of thing that ships.
    expect(FEATURES.length).toBeGreaterThan(0);
    expect(PRINCIPLES.length).toBeGreaterThan(0);
    expect(QUESTIONS.length).toBeGreaterThan(0);
    expect(GUIDE_DOORS.length).toBeGreaterThan(0);
  });
});
