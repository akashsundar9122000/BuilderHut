import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { MOTION_EVENT, motionScript, resolveMotion, type MotionPreference } from "@/lib/motion";

/*
 * The motion preference is resolved twice: once by the inline script before
 * first paint, and once by `resolveMotion` when someone uses the footer
 * control. They are separate code — one is a string — so this runs the actual
 * string against a fake document, for every combination, and holds it to the
 * function.
 */
function runScript(stored: string | null, osReduces: boolean, storageThrows = false) {
  const dataset: Record<string, string> = {};
  const listeners: Array<() => void> = [];
  const dispatched: string[] = [];
  const mq = {
    matches: osReduces,
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
  };
  const env = {
    document: { documentElement: { dataset } },
    matchMedia: () => mq,
    localStorage: {
      getItem: () => {
        if (storageThrows) throw new Error("blocked");
        return stored;
      },
    },
    window: { dispatchEvent: (e: { type: string }) => dispatched.push(e.type) },
    Event: class {
      constructor(public type: string) {}
    },
  };
  new Function(...Object.keys(env), motionScript)(...Object.values(env));
  return { dataset, mq, listeners, dispatched };
}

describe("motionScript", () => {
  const cases: Array<[string | null, boolean]> = [
    [null, false],
    [null, true],
    ["full", false],
    ["full", true],
    ["reduce", false],
    ["reduce", true],
    ["garbage", true],
  ];

  it.each(cases)("stored %s with OS reduce=%s agrees with resolveMotion", (stored, os) => {
    const pref: MotionPreference = stored === "full" || stored === "reduce" ? stored : "auto";
    expect(runScript(stored, os).dataset.motion).toBe(resolveMotion(pref, os));
  });

  it("falls back to the OS setting when storage is blocked", () => {
    expect(runScript(null, true, true).dataset.motion).toBe("reduce");
    expect(runScript(null, false, true).dataset.motion).toBe("full");
  });

  it("follows the OS setting changing mid-visit, and tells React", () => {
    const run = runScript(null, false);
    expect(run.dataset.motion).toBe("full");

    run.mq.matches = true;
    run.listeners.forEach((fn) => fn());

    expect(run.dataset.motion).toBe("reduce");
    expect(run.dispatched).toEqual([MOTION_EVENT]);
  });

  it("never lets an explicit choice be overridden by the OS changing", () => {
    const run = runScript("full", true);
    run.mq.matches = false;
    run.listeners.forEach((fn) => fn());
    run.mq.matches = true;
    run.listeners.forEach((fn) => fn());
    expect(run.dataset.motion).toBe("full");
  });
});

describe("the motion library's reach", () => {
  it("is imported only by the marketing surface", () => {
    /*
     * The storefront budget is the one that matters (a small business's shop,
     * on a phone, on a slow connection), and the dashboard and builder have no
     * use for a second animation system. `motion` is for the marketing pages;
     * a single import from anywhere else puts it in a bundle it has no
     * business in, and nothing else would notice.
     */
    const hits = execSync(
      `git grep --untracked -lE "from ['\\"](motion|framer-motion)(/|['\\"])" -- '*.ts' '*.tsx' || true`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .filter((file) => !file.startsWith("components/marketing/"));

    expect(hits).toEqual([]);
  });
});
