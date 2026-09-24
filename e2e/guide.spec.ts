import { expect, test } from "@playwright/test";

/*
 * The guide, as a reader meets it.
 *
 * Not a re-check of scripts/build-guide.mjs — tests/unit/guide.test.ts already
 * owns the generated data. What is here is the behaviour that only exists in a
 * browser: whether the guide can be reached at all on a phone, whether the
 * contents get out of the way once they have been used, and whether search
 * crosses the audience it is filtering.
 */

test.describe("finding the guide", () => {
  test("is reachable from the home page", async ({ page }) => {
    await page.goto("/");

    /*
     * The marketing header's nav is `hidden md:flex`, so on a phone there is no
     * navigation in the header at all — and no menu button either, because the
     * marketing pages never had one. The landing page's own guide section is
     * the path on a phone, and this is the assertion that keeps it there.
     */
    await page.getByRole("link", { name: "Start reading" }).click();
    await expect(page).toHaveURL(/\/guide\/start\/welcome$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What BuilderHut is");
  });
});

test.describe("an article", () => {
  test("renders its prose, callouts and steps", async ({ page }) => {
    await page.goto("/guide/start/welcome");

    await expect(page.locator(".gd-prose .gd-callout").first()).toBeVisible();
    await expect(page.locator(".gd-prose .gd-steps > li").first()).toBeVisible();

    // A <figure> inside a <p> is invalid, and the browser silently closes the
    // paragraph early — so this is the assertion that the compiler unwrapped it.
    expect(await page.locator(".gd-prose p > figure").count()).toBe(0);
  });

  test("opens an FAQ answer", async ({ page }) => {
    await page.goto("/guide/start/welcome");
    const question = page.locator(".gd-faq summary").first();
    const answer = page.locator(".gd-faq details").first().locator("div");

    await expect(answer).toBeHidden();
    await question.click();
    await expect(answer).toBeVisible();
  });

  test("tells search engines to skip the engineering guide", async ({ page }) => {
    await page.goto("/guide/engineering/architecture");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );

    // …and to index the merchant guide, which is the half of this that a
    // mistake in the audience table would break silently.
    await page.goto("/guide/start/welcome");
    expect(await page.locator('meta[name="robots"]').count()).toBe(0);
  });
});

test.describe("the contents", () => {
  test("filters across every audience while searching", async ({ page, isMobile }) => {
    await page.goto("/guide/start/welcome");

    // Both copies of the nav are in the DOM and differ only in which width
    // shows them, so the id is what stops this driving the hidden one.
    if (isMobile) await page.getByRole("button", { name: "Guide contents" }).click();
    const nav = page.locator(isMobile ? "#guide-nav-mobile" : "#guide-nav-desktop");

    // "surfaces" is in the engineering page's summary and one of its headings,
    // and nowhere in the merchant guide — so a hit proves the filter crossed
    // the audience the reader is standing in. Body prose is deliberately not
    // searched; see components/guide/Nav.tsx.
    await nav.getByRole("searchbox").fill("surfaces");
    await expect(nav.getByRole("link", { name: "Architecture at a glance" })).toBeVisible();
  });

  test("says so when nothing matches", async ({ page, isMobile }) => {
    await page.goto("/guide/start/welcome");
    if (isMobile) await page.getByRole("button", { name: "Guide contents" }).click();
    const nav = page.locator(isMobile ? "#guide-nav-mobile" : "#guide-nav-desktop");

    await nav.getByRole("searchbox").fill("xyzzy");
    await expect(nav.getByText(/Nothing matches/)).toBeVisible();
  });
});

test.describe("the contents on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the drawer only exists below lg");

  test("closes itself once a page has been chosen", async ({ page }) => {
    await page.goto("/guide/start/welcome");

    const toggle = page.getByRole("button", { name: "Guide contents" });
    await toggle.click();
    await expect(page.locator("#guide-nav-mobile")).toBeVisible();

    await page.locator("#guide-nav-mobile").getByRole("link", { name: "API and MCP" }).click();
    await expect(page).toHaveURL(/\/guide\/api\//);

    /*
     * Without this the contents stay open over the page the reader just chose,
     * and they have to dismiss the menu to read what they asked for.
     */
    await expect(page.locator("#guide-nav-mobile")).toBeHidden();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("the contents keep their place", () => {
  test.skip(({ isMobile }) => isMobile, "the drawer closes on navigate, so it has no place to keep");

  test("stays where the reader scrolled it when they choose a page", async ({ page }) => {
    await page.goto("/guide/start/welcome");
    const nav = page.locator("#guide-nav-desktop");
    await expect(nav).toBeVisible();

    /*
     * Every guide page is its own route, so choosing one unmounts this list and
     * builds a new one. Without somewhere to put the position back, a reader
     * twenty links down was returned to the top on every single navigation.
     */
    /*
     * Scroll the target into view explicitly before measuring. Clicking would
     * do it anyway — a reader scrolls until they can see the link — but doing
     * it here means the position is settled when it is read, rather than
     * changing between the measurement and the click.
     */
    const link = nav.getByRole("link", { name: "Orders and refunds" });
    await link.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);

    const before = await nav.evaluate((el) => el.scrollTop);
    expect(before, "the list should have scrolled to reach the link").toBeGreaterThan(0);

    await link.click();
    await page.waitForURL(/\/guide\/running\/orders$/);

    const after = await page.locator("#guide-nav-desktop").evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThan(40);
  });

  test("scrolls a deep page into view when there is nothing to restore", async ({ page }) => {
    // A fresh session arriving from a search result, rather than from the index.
    await page.goto("/guide/help/how-do-i");
    const nav = page.locator("#guide-nav-desktop");
    await expect(nav).toBeVisible();
    expect(await nav.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  });
});

test.describe("the theme toggle", () => {
  /*
   * One shared component, used by the marketing header, the dashboard, the
   * admin console, onboarding and the auth pages — so this covers all of them.
   */
  for (const theme of ["light", "dark"] as const) {
    test(`in ${theme} mode it offers the other one`, async ({ page }) => {
      await page.addInitScript((value) => {
        try {
          localStorage.setItem("bh-theme", value as string);
        } catch {}
      }, theme);
      await page.goto("/guide");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      const other = theme === "dark" ? "light" : "dark";
      const button = page.getByRole("button", { name: `Switch to ${other} mode` }).first();
      await expect(button).toBeVisible();

      /*
       * And the icon must agree with the label. It used to show the mode you
       * were already in, so in dark mode it drew a moon while announcing
       * "switch to light mode" — a control describing its state rather than
       * what pressing it does.
       */
      const icon = await button.locator("svg").getAttribute("class");
      expect(icon).toContain(other === "light" ? "sun" : "moon");
    });
  }
});
