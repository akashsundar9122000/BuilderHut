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

  it("puts every scroll-driven animation behind prefers-reduced-motion", () => {
    /*
     * The trap this file exists for.
     *
     * The global reset in tokens.css neutralises motion with
     * `animation-duration: 0.01ms !important`. That works on a time-based
     * animation and does NOTHING to a scroll-driven one: once
     * `animation-timeline` is set, duration is ignored outright and progress
     * comes from the scroll position instead. So a scroll-driven effect
     * written outside a no-preference block sails straight through the
     * accessibility setting meant to stop it, and the only way to find out is
     * to be someone who needs it.
     *
     * Hence: every `animation-timeline` must sit inside
     * `@media (prefers-reduced-motion: no-preference)`. Counting braces is
     * crude and entirely sufficient — it is asking one structural question.
     */
    const lines = CSS.split("\n");
    let depth = 0;
    let guardedFrom: number | null = null;
    const unguarded: string[] = [];

    lines.forEach((line, index) => {
      if (/@media[^{]*prefers-reduced-motion:\s*no-preference/.test(line) && guardedFrom === null) {
        guardedFrom = depth;
      }

      if (/\banimation-timeline\s*:/.test(line) && guardedFrom === null) {
        unguarded.push(`${index + 1}: ${line.trim()}`);
      }

      depth += (line.match(/\{/g) ?? []).length;
      depth -= (line.match(/\}/g) ?? []).length;

      if (guardedFrom !== null && depth <= guardedFrom) guardedFrom = null;
    });

    expect(unguarded).toEqual([]);
  });

  it("actually contains the scroll-driven upgrade it is here to hold", () => {
    // Guard on the guard: the two rules above both pass trivially against an
    // empty file, and a stylesheet that lost its @supports block would look
    // green while the page quietly went back to plain fades.
    expect(CSS).toContain("@supports (animation-timeline: view())");
    expect(CSS).toMatch(/animation-timeline:\s*view\(\)/);
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
