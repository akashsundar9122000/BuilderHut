import { expect, test, type Page } from "@playwright/test";

/*
 * The motion contract for the marketing pages.
 *
 * Nothing else in the suite can make these assertions, and it is worth being
 * precise about why: Playwright's toBeVisible() checks the bounding box and
 * `visibility`, and treats opacity:0 as visible. So a reveal that never fires
 * — an observer that failed, a hidden state written outside the motion scope,
 * a scroll-timeline range that parks part-finished — passes every other test
 * on a page nobody can actually read. These look at computed opacity instead.
 *
 * Ported from Market Place's e2e/tests/motion.spec.ts, which exists because
 * that page went blank this way.
 */

/** Anything that can start hidden and has to be shown again. */
const REVEALED = "[data-reveal], .bh-mk-stagger > *, .bh-mk-enter";

/**
 * Elements the reader has reached that are still fully transparent.
 *
 * "Reached" matters: where `animation-timeline: view()` is supported a reveal
 * is a POSITION rather than a trigger, so an element below the fold sits at
 * opacity 0 by design and asserting on it would assert against the feature.
 * The pinned build sequence and its stacked twin both exist in the DOM with
 * one at display:none, whose rect is all zeros — skipped, since it is
 * unreachable and out of the accessibility tree too.
 */
async function reachedButInvisible(page: Page) {
  return page.locator(REVEALED).evaluateAll((nodes) =>
    nodes
      .filter((n) => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        return r.top < window.innerHeight;
      })
      .filter((n) => getComputedStyle(n).opacity === "0")
      .map((n) => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 60)}`),
  );
}

async function walkDown(page: Page) {
  const steps = await page.evaluate(() => Math.ceil(document.body.scrollHeight / innerHeight));
  for (let i = 0; i <= steps; i++) {
    await page.evaluate((n) => window.scrollTo(0, n * innerHeight), i);
    await page.waitForTimeout(200);
  }
  // Longer than --bh-duration-reveal plus the deepest stagger step.
  await page.waitForTimeout(1400);
}

const reduced = (name: string) => name === "reduced-motion";

for (const path of ["/", "/templates", "/pricing"]) {
  test(`${path}: every part the reader has reached is opaque`, async ({ page }, info) => {
    await page.goto(path);

    if (reduced(info.project.name)) {
      /*
       * Under reduce the hidden state must not exist at all, so this holds on
       * a page nobody has touched: no scroll, no observer, no hydration. This
       * is the assertion that catches a hidden state written outside the
       * motion scope — the way these pages go blank.
       */
      const invisible = await reachedButInvisible(page);
      expect(invisible, `hidden without being scrolled to: ${invisible.join(", ")}`).toEqual([]);
      return;
    }

    await walkDown(page);
    const invisible = await reachedButInvisible(page);
    expect(invisible, `still at opacity 0 after scrolling past: ${invisible.join(", ")}`).toEqual(
      [],
    );
  });

  test(`${path}: the first heading is opaque before anything runs`, async ({ page }) => {
    /*
     * The regression this guards: the heading used to be server-rendered at
     * opacity 0 inside a Reveal, waiting for hydration. With JavaScript off,
     * nothing can reveal it — so if it is opaque here, it never depended on
     * script to be seen.
     */
    await page.context().route("**/*.js", (route) => route.abort());
    await page.goto(path);
    // The first heading rather than the h1: /pricing's title is an h2.
    await expect(page.locator("h1, h2").first()).toHaveCSS("opacity", "1");
  });
}

test("the hero headline takes no part in the entrance", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1, name: /sell what you make/i });
  // Opaque in the first frame, in every project — it is the largest element on
  // the page and an entrance on it is an LCP delay by definition.
  await expect(h1).toHaveCSS("opacity", "1");
  expect(await h1.evaluate((n) => n.getAnimations().length)).toBe(0);
});

test("the build sequence renders exactly one of its two layouts", async ({ page }) => {
  await page.goto("/");
  const pinned = page.locator(".bh-mk-seq__pinned");
  const stacked = page.locator(".bh-mk-seq__stacked");
  await expect(pinned).toHaveCount(1);
  await expect(stacked).toHaveCount(1);
  // display:none is what keeps the other one out of the accessibility tree, so
  // "exactly one visible" is an a11y assertion as much as a layout one.
  const visible = [await pinned.isVisible(), await stacked.isVisible()].filter(Boolean);
  expect(visible).toHaveLength(1);
});

test("under reduced motion nothing loops", async ({ page }, info) => {
  test.skip(!reduced(info.project.name), "asserts the reduced-motion path specifically");
  await page.goto("/");
  // 1ms of an infinite animation is a strobe, not a stillness. The backstop
  // collapses duration; every loop has to be cancelled outright.
  const looping = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations === Infinity)
      .map((a) => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return target ? `${target.tagName.toLowerCase()}.${String(target.className)}` : "?";
      }),
  );
  expect(looping, `still looping: ${looping.join(", ")}`).toEqual([]);
});

test.describe("the footer's motion control", () => {
  test("Reduced overrides the OS, survives a reload, and Auto hands back", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-motion", "full");

    const control = page.getByRole("group", { name: "Motion" });
    await control.getByText("Reduced", { exact: true }).click();
    await expect(html).toHaveAttribute("data-motion", "reduce");
    await expect(control.getByRole("radio", { name: "Reduced" })).toBeChecked();

    // Read back from a fresh document, not from the state the click left: the
    // pre-paint script has to find the choice on its own.
    await page.reload();
    await expect(html).toHaveAttribute("data-motion", "reduce");
    const loops = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity)
          .length,
    );
    expect(loops).toBe(0);

    await control.getByText("Auto", { exact: true }).click();
    await expect(html).toHaveAttribute("data-motion", "full");
  });

  test("On overrides an OS that asks for less", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-motion", "reduce");

    await page.getByRole("group", { name: "Motion" }).getByText("On", { exact: true }).click();
    await expect(html).toHaveAttribute("data-motion", "full");

    await page.reload();
    await expect(html).toHaveAttribute("data-motion", "full");
  });

  test("follows the OS setting changing mid-visit", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  });
});
