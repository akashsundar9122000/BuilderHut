import { expect, test, type Page } from "@playwright/test";

import {
  closeBuilderPanel,
  openBuilderPanel,
  readVerificationCode,
  signUpMerchant,
} from "./support/journey";
import { MAIL_LOG } from "./support/paths";

/*
 * Phase 2: the visual builder.
 *
 * The assertions here are the ones that caught real bugs while it was built —
 * a theme control that changed the document but nothing on screen, a section
 * that rendered as nothing when added, duplicate DOM ids from rendering the
 * inspector twice. Each is cheap to check and expensive to notice by eye.
 *
 * The server is started by Playwright; see e2e/support/paths.ts for how the
 * verification codes are read back.
 */


/*
 * "Saved", and only "Saved".
 *
 * getByText matches a case-insensitive SUBSTRING, so getByText("Saved") also
 * matches "Unsaved changes" — the state immediately before a save, which is on
 * screen the instant anything is typed. Every wait-for-the-save in this file
 * was therefore passing at once and asserting nothing, and a test that then
 * reloaded lost the edit it had just made and blamed the editor for it.
 */
const SAVED = (page: Page) => page.getByText("Saved", { exact: true });

test.describe("visual builder", () => {
  test.describe.configure({ mode: "serial" });

  /*
   * One page for the whole journey.
   *
   * Playwright gives every test its own browser context, which means its own
   * cookie jar — so a spec that signs in during the first test and relies on
   * being signed in during the second is signed out before it starts. Serial
   * mode fixes the ORDER, not the isolation. The journeys here are genuinely
   * sequential (you cannot add a product to a store you have not created), so
   * they share one page, opened once.
   *
   * Tests that deliberately want a clean visitor — a shopper who is not the
   * merchant — still take `browser` and open their own context.
   */
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  const tag = Date.now().toString(36);
  const email = `builder-${tag}@builderhut.test`;

  test("create a store with a product, then open the builder", async () => {
    await signUpMerchant(page, { name: "Builder Tester", email });

    const code = await readVerificationCode(MAIL_LOG, email);
    await page.fill('input[aria-label="Digit 1"]', code);
    await page.waitForURL(/\/onboarding/);

    await page.click('button:has-text("Crochet & Yarn")');
    await page.click('button:has-text("Continue")');
    await page.fill("#store-name", `Loom ${tag}`);
    await expect(page.getByText("That one's free.")).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("Instagram")');
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("A full online shop")');
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("India")');
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("Create my store")');
    await page.waitForURL(/\/app(\?|$)/);

    await page.goto("/app/products/new");
    await page.fill("#name", "Wool throw");
    await page.fill("#price", "2400");
    await page.click('button[type="submit"]');
    // Wait on the list page's own copy: /app/products and /app/products/new
    // share a prefix, so a URL regex matches before the save has happened.
    await expect(page.getByText("in your catalogue")).toBeVisible();

    await page.goto("/app/builder");
    // At phone width the inspector is a sheet, so it has to be opened rather
    // than assumed present.
    await openBuilderPanel(page, "Settings");
    // The canvas shows the merchant's OWN products, not placeholders.
    expect(await page.content()).toContain("Wool throw");
  });

  test("every control id is unique", async () => {
    await page.goto("/app/builder");
    // Opened rather than assumed: at phone width the inspector is a sheet, and
    // waiting for it to be visible was silently matching the server-rendered
    // desktop frame before hydration replaced it.
    await openBuilderPanel(page, "Settings");

    const duplicates = await page.evaluate(() => {
      const counts = new Map<string, number>();
      for (const el of document.querySelectorAll("[id]")) {
        counts.set(el.id, (counts.get(el.id) ?? 0) + 1);
      }
      return [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    });
    // Rendering the inspector twice (desktop and mobile) duplicated every id,
    // which silently broke each label's association with its input.
    expect(duplicates).toEqual([]);
  });

  test("editing a section updates the canvas, and undo reverts it", async () => {
    await page.goto("/app/builder");
    await page.click("text=Made slowly");
    await page.fill("#ctrl-heading", "Warm things for cold rooms");

    await expect(page.getByText("Warm things for cold rooms").first()).toBeVisible();
    await expect(SAVED(page)).toBeVisible({ timeout: 20_000 });

    await page.keyboard.press("Control+z");
    await expect(page.getByText("Warm things for cold rooms")).toHaveCount(0);

    await page.keyboard.press("Control+Shift+z");
    await expect(page.getByText("Warm things for cold rooms").first()).toBeVisible();
  });

  /*
   * Typing does not stop for the network.
   *
   * With a real round trip in the way — Mumbai to Singapore, or any phone on
   * mobile data — a merchant types straight through a save. Everything typed
   * during one used to be dropped: the reply marked the draft clean, so those
   * keystrokes were never sent, and the badge said "Saved" over a document
   * that was not. Worse, the save that followed went out with a revision one
   * behind and came back a conflict, which the editor resolved by replacing
   * what was on screen with the older copy it had just sent — so the words
   * disappeared from the canvas too, and it looked as though the editor had
   * simply ignored them.
   *
   * The delay is what makes this deterministic: against a local server the
   * window is a few milliseconds wide and the bug hides.
   */
  test("words typed during a save are not lost", async () => {
    await page.goto("/app/builder");
    await page.route("**/app/builder", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });

    const heading = page.locator("[data-storefront] h1").first();
    try {
      await openBuilderPanel(page);
      await page.click('button[role="tab"]:has-text("Layers")');
      await page.click('button:has-text("Hero")');

      await page.fill("#ctrl-heading", "First half");
      // Long enough for the debounce to fire and the request to still be open.
      await page.waitForTimeout(1600);
      await page.fill("#ctrl-heading", "First half and second half");
      await closeBuilderPanel(page);

      await expect(heading).toHaveText("First half and second half");
      await expect(SAVED(page)).toBeVisible({ timeout: 20_000 });
    } finally {
      await page.unroute("**/app/builder");
    }

    // And that is what was stored, not merely what stayed on screen.
    await page.reload();
    await expect(heading).toHaveText("First half and second half");
  });

  test("a new section lands below the selection, and the canvas goes to it", async () => {
    await page.goto("/app/builder");

    // Select something in the middle of the page, then add below it.
    await openBuilderPanel(page);
    await page.click('button[role="tab"]:has-text("Layers")');
    await page.click('button:has-text("Hero")');

    /*
     * On a phone, selecting a section swaps the sheet from the section list to
     * that section's settings — which is the right behaviour and means the Add
     * tab is no longer on screen. Both are reopened rather than assumed; at
     * desktop width these are no-ops.
     */
    await closeBuilderPanel(page);
    await openBuilderPanel(page);
    await page.click('button[role="tab"]:has-text("Add")');
    await page.click('button:has-text("Testimonials")');
    await closeBuilderPanel(page);

    const order = await page.evaluate(() =>
      [...document.querySelectorAll("[data-section-id]")].map(
        (el) => (el as HTMLElement).dataset.sectionId,
      ),
    );
    const hero = order.findIndex((id) => id?.startsWith("home-hero"));
    const added = order.findIndex((id) => id?.startsWith("testimonials-"));
    expect(hero, "the hero should still be on the page").toBeGreaterThanOrEqual(0);
    // Directly below what was selected, not at the far end of the page.
    expect(added).toBe(hero + 1);

    /*
     * And it is on screen.
     *
     * This is the bug that made the whole editor look broken: adding a section
     * selected it and filled the inspector with its settings, but the canvas
     * stayed where it was — so typing a heading changed something three
     * screens down and nothing a merchant could see.
     */
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const shell = [...document.querySelectorAll("[data-section-id]")].find((el) =>
              (el as HTMLElement).dataset.sectionId?.startsWith("testimonials-"),
            );
            if (!shell) return false;
            const scroller = shell.closest(".overflow-y-auto")!;
            const box = shell.getBoundingClientRect();
            const frame = scroller.getBoundingClientRect();
            return box.top < frame.bottom && box.bottom > frame.top;
          }),
        // Polled rather than read once: the scroll is smooth, so it is still
        // travelling when the click returns.
        { message: "the new section should have been scrolled into view" },
      )
      .toBe(true);
  });

  test("a newly added section is visible and fillable", async () => {
    await page.goto("/app/builder");
    await openBuilderPanel(page);
    await page.click('button[role="tab"]:has-text("Add")');
    await page.click('button:has-text("FAQ")');

    // An empty FAQ renders nothing on a live storefront, which in the editor
    // made "Add" look like it had done nothing at all.
    await expect(page.getByText("Add a question in the panel")).toBeVisible();

    /*
     * No click to select it: adding a section selects it, so the inspector is
     * already showing its settings. On a phone that is the whole point — the
     * sheet swaps from the section list to the new section's settings, and
     * there is no canvas to tap because the sheet is over it.
     */
    await page.click('button:has-text("Add question")');
    await page.fill('input[aria-label="Question"]', "Do you post overseas?");
    await page.fill('textarea[aria-label="Answer"]', "Within India only, for now.");
    await expect(page.getByText("Do you post overseas?").first()).toBeVisible();
  });

  /*
   * A gallery's photographs.
   *
   * The schema has always had an images array and the storefront has always
   * rendered it — the inspector simply had no control for it, so the only
   * gallery a merchant could build was a row of grey placeholders. Adding one
   * was the whole point; this is the assertion that it reaches the canvas.
   */
  test("a gallery takes photographs", async () => {
    await page.goto("/app/builder");
    await openBuilderPanel(page);
    await page.click('button[role="tab"]:has-text("Add")');
    await page.click('button:has-text("Gallery")');

    /*
     * The address field rather than an upload. A file picker here would put
     * the media store — a real Cloudflare namespace — on the critical path of
     * a layout test, and a suite that fails when someone else's service is
     * slow is a suite people learn to ignore.
     */
    const address = page.getByLabel("Add pictures by address");
    await address.fill("https://example.test/kiln.jpg");
    await address.press("Enter");

    const alt = page.getByLabel("Describe picture 1");
    await expect(alt).toBeVisible();
    await alt.fill("The kiln, mid-firing");
    await closeBuilderPanel(page);

    const tile = page.locator('[data-storefront] img[src="https://example.test/kiln.jpg"]');
    await expect(tile).toHaveCount(1);
    // Alt text is the reason the field is beside the picture rather than
    // behind a dialog; it has to actually arrive.
    await expect(tile).toHaveAttribute("alt", "The kiln, mid-firing");
  });

  test("theme controls actually repaint the canvas", async () => {
    await page.goto("/app/builder");

    const headingBefore = await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-storefront] h1")!).fontFamily,
    );

    await openBuilderPanel(page, "Settings");
    await page.fill('input[aria-label="Buttons"]', "#1d4ed8");
    await page.selectOption("#font-heading", "archivo");

    const primary = await page.evaluate(() =>
      getComputedStyle(document.querySelector("[data-storefront]")!)
        .getPropertyValue("--sf-primary")
        .trim(),
    );
    expect(primary).toBe("#1d4ed8");

    /*
     * The font assertion is the one that matters. The picker changed the
     * document and repainted nothing, because the builder had not loaded the
     * storefront font families — so --font-archivo was undefined, the whole
     * custom property became invalid, and the text silently kept its old face.
     */
    const headingAfter = await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-storefront] h1")!).fontFamily,
    );
    expect(headingAfter).not.toBe(headingBefore);
    expect(headingAfter).toMatch(/Archivo/i);
  });

  /*
   * The Preview button used to open /s/<slug> — the PUBLISHED store — so a
   * merchant who had just spent ten minutes editing opened it and found none
   * of their work there, which reads as the editor having thrown it away.
   */
  test("preview shows the unpublished draft", async () => {
    await page.goto("/app/builder");
    await openBuilderPanel(page);
    await page.click('button[role="tab"]:has-text("Layers")');
    await page.click('button:has-text("Hero")');
    await page.fill("#ctrl-heading", "Not published yet");
    // The canvas is live, and then the draft is stored: the preview renders
    // what was stored, so both have to be true before it is worth looking at.
    await expect(page.getByText("Not published yet").first()).toBeVisible();
    await expect(SAVED(page)).toBeVisible({ timeout: 20_000 });
    // It survives a reload, so it really is in the draft the preview reads.
    await page.reload();
    await expect(page.getByText("Not published yet").first()).toBeVisible();
    await closeBuilderPanel(page);

    /*
     * The route rather than the button, because the button opens a tab and a
     * popup is awkward to drive at two viewports. What the button does beyond
     * this is flush the save, which the assertion above has already waited for.
     */
    await page.goto("/app/builder/preview");
    await expect(page.getByText("Draft preview")).toBeVisible();
    await expect(page.getByText("Not published yet").first()).toBeVisible();

    // Links inside the preview stay inside the preview rather than jumping to
    // the published store halfway through a look around.
    const shopLink = page.locator('a[href="/app/builder/preview/shop"]').first();
    await expect(shopLink).toHaveCount(1);

    // A path the draft has no page for says so, rather than dropping the
    // merchant onto BuilderHut's own 404 in the middle of their shop.
    await page.goto("/app/builder/preview/cart");
    await expect(page.getByText("Not part of your draft")).toBeVisible();
  });

  test("publishing makes the draft live, and history records it", async () => {
    await page.goto("/app/builder");
    /*
     * Selected through the layer tree rather than by clicking its text on the
     * canvas: the tests before this one have already edited that heading, so
     * anything that names the copy is asserting the previous test's state.
     */
    await openBuilderPanel(page);
    await page.click('button[role="tab"]:has-text("Layers")');
    await page.click('button:has-text("Hero")');
    await page.fill("#ctrl-heading", "Warm things for cold rooms, published");
    await expect(SAVED(page)).toBeVisible({ timeout: 20_000 });
    await closeBuilderPanel(page);

    /*
     * Two steps, on purpose. Publish opens the readiness panel first — a
     * merchant about to make something public gets to see what is unfinished
     * before it goes live (blueprint section 59) — and only the button inside
     * the panel actually publishes.
     */
    await page.click('button:has-text("Publish")');
    const panel = page.getByRole("dialog", { name: "Publish your shop" });
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Publish my shop" }).click();

    await expect(page.getByText("Your store is live")).toBeVisible({ timeout: 30_000 });

    /*
     * The slug from the builder's own Preview link, while we are still on the
     * builder. Two earlier attempts were wrong in different ways: a regex over
     * the dashboard's text found whichever `/s/...` appeared first, and the
     * sidebar's "View my store" does not exist at phone width. This anchor is
     * in the document at every width, whether or not it is visible.
     */
    const href = await page.locator('a[href^="/s/"]').first().getAttribute("href");
    const slug = href!.split("/s/")[1]!.replace(/\/.*$/, "");

    await page.goto(`/s/${slug}`);
    // updateTag on publish means this is visible immediately, not in five minutes.
    await expect(page.getByText("Warm things for cold rooms, published").first()).toBeVisible();

    await page.goto("/app/builder");
    await closeBuilderPanel(page);
    await page.click('button[aria-label="Version history"]');
    // Version 1 was created at store creation; this publish is version 2.
    await expect(page.getByText("Version 2")).toBeVisible({ timeout: 15_000 });
  });
});
