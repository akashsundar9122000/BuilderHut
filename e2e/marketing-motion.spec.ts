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
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveCSS("opacity", "1");
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

test.describe("the hero's design cycle", () => {
  /* The stage's address bar names the design showing. */
  const address = (page: Page) => page.locator("main").getByText(/\.builderhut\.app$/).first();
  const designs = (page: Page) =>
    page.getByRole("group", { name: "Show this shop in another design" });

  test("changes design on its own, and exposes only the one showing", async ({ page }, info) => {
    test.skip(reduced(info.project.name), "the cycle never starts under reduced motion");
    await page.mouse.move(1, 1); // hovering the stage pauses it, by design
    await page.goto("/");
    await expect(address(page)).toHaveText("thread.builderhut.app");
    await expect(address(page)).toHaveText("parcel.builderhut.app", { timeout: 9_000 });

    // Four frames in the DOM, one in the accessibility tree: the others are
    // aria-hidden and inert, so a screen reader hears one shop, not four.
    await expect(page.getByRole("img", { name: /preview of the parcel template/i })).toHaveCount(1);
    await expect(page.getByRole("img", { name: /preview of the facet template/i })).toHaveCount(0);
  });

  test("stops for good once somebody picks a design", async ({ page }, info) => {
    test.skip(reduced(info.project.name), "the cycle never starts under reduced motion");
    await page.goto("/");
    await designs(page).getByRole("button", { name: "Facet" }).click();
    await page.mouse.move(1, 1); // and moves away again — it must not resume
    await expect(address(page)).toHaveText("facet.builderhut.app");
    await page.waitForTimeout(6_500);
    await expect(address(page)).toHaveText("facet.builderhut.app");
    await expect(designs(page).getByRole("button", { name: "Facet" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("has a stop control, and it stops", async ({ page }, info) => {
    test.skip(reduced(info.project.name), "the cycle never starts under reduced motion");
    await page.goto("/");
    await page.getByRole("button", { name: "Stop changing designs" }).click();
    await page.mouse.move(1, 1);
    await page.waitForTimeout(6_500);
    await expect(address(page)).toHaveText("thread.builderhut.app");
    await expect(page.getByRole("button", { name: "Keep changing designs" })).toBeVisible();
  });

  test("never starts under reduced motion, but the designs still switch", async ({ page }, info) => {
    test.skip(!reduced(info.project.name), "asserts the reduced-motion path specifically");
    await page.mouse.move(1, 1);
    await page.goto("/");
    await page.waitForTimeout(6_500);
    await expect(address(page)).toHaveText("thread.builderhut.app");
    await expect(page.getByRole("button", { name: "Stop changing designs" })).toHaveCount(0);

    // Reduced motion takes away the autoplay, not the feature.
    await designs(page).getByRole("button", { name: "Stitch" }).click();
    await expect(address(page)).toHaveText("stitch.builderhut.app");
  });
});

test.describe("the template tabs", () => {
  test("behave like tabs: one stop, arrow keys, a labelled panel", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "keyboard journey");
    await page.goto("/");
    const list = page.getByRole("tablist", { name: "Templates" });
    const tabs = list.getByRole("tab");
    await list.scrollIntoViewIfNeeded();

    // One tab stop for the whole row.
    await expect(list.locator('[tabindex="0"]')).toHaveCount(1);

    const first = tabs.nth(0);
    const second = tabs.nth(1);
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(first).toHaveAttribute("aria-selected", "false");

    // The panel is named by the tab showing it.
    const name = (await second.textContent())!.trim();
    await expect(page.getByRole("tabpanel", { name })).toBeVisible();

    await page.keyboard.press("End");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight"); // wraps
    await expect(first).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("the numbers band", () => {
  test("counts to the true figure, and says it once to a screen reader", async ({ page }) => {
    await page.goto("/");
    const band = page.locator("dl").filter({ hasText: "designs to start from" });
    await band.scrollIntoViewIfNeeded();
    const figure = band.locator("dd").first();

    // Whatever the motion setting, it comes to rest on the real count — the
    // number of templates, as the /templates page states it.
    await expect(figure.locator("[aria-hidden]").last()).toHaveText("12", { timeout: 5_000 });
    // Exactly one copy of the value is exposed; the moving digits are hidden.
    await expect(figure.locator(".sr-only")).toHaveText("12");
  });
});

test.describe("the theme toggle", () => {
  test("switches the theme, and tidies up after its transition", async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "the toggle is in the desktop header");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    // The reveal's scoping attribute must not outlive the reveal, or every
    // later view transition on the page loses its crossfade.
    await expect(html).not.toHaveAttribute("data-theme-switching", /.*/, { timeout: 3_000 });
  });
});

test.describe("the template morph", () => {
  test("following a template runs a view transition into its preview", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "Chromium's view transitions, once");
    // Count the transitions React starts, without changing what they do.
    await page.addInitScript(() => {
      const w = window as unknown as { __vt: number };
      w.__vt = 0;
      if (!document.startViewTransition) return;
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (arg?: Parameters<typeof original>[0]) => {
        w.__vt += 1;
        return original(arg);
      };
    });
    await page.goto("/templates");
    await page.getByRole("link", { name: "Preview Thread" }).click();
    await expect(page).toHaveURL(/\/templates\/thread$/);
    await expect(page.getByRole("heading", { level: 1, name: "Thread" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBeGreaterThan(0);
  });
});

test("the landing page's last band meets the footer, with no strip between", async ({ page }) => {
  await page.goto("/");
  const gap = await page.evaluate(() => {
    const main = document.querySelector("[data-mk] main")!;
    const last = main.lastElementChild!.getBoundingClientRect();
    const footer = document.querySelector("[data-mk] footer")!.getBoundingClientRect();
    return Math.round(footer.top - last.bottom);
  });
  expect(gap).toBe(0);
});
