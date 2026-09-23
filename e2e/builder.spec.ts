import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

/*
 * Phase 2: the visual builder.
 *
 * The assertions here are the ones that caught real bugs while it was built —
 * a theme control that changed the document but nothing on screen, a section
 * that rendered as nothing when added, duplicate DOM ids from rendering the
 * inspector twice. Each is cheap to check and expensive to notice by eye.
 *
 * Needs BH_E2E_MAIL_LOG; see merchant-journey.spec.ts.
 */

const MAIL_LOG = process.env.BH_E2E_MAIL_LOG;

test.describe("visual builder", () => {
  test.skip(!MAIL_LOG, "set BH_E2E_MAIL_LOG to the server's output file");
  test.describe.configure({ mode: "serial" });

  const tag = Date.now().toString(36);
  const email = `builder-${tag}@builderhut.test`;

  test("create a store with a product, then open the builder", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#name", "Builder Tester");
    await page.fill("#email", email);
    await page.fill("#password", "a-long-enough-password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/verify/);

    const log = readFileSync(MAIL_LOG!, "utf8");
    const code = [
      ...log.matchAll(
        new RegExp(`To:\\s+${email}[\\s\\S]{0,400}?verification code is (\\d{6})`, "g"),
      ),
    ].pop()![1]!;
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
    await expect(page.getByText("Store style")).toBeVisible();
    // The canvas shows the merchant's OWN products, not placeholders.
    expect(await page.content()).toContain("Wool throw");
  });

  test("every control id is unique", async ({ page }) => {
    await page.goto("/app/builder");
    await expect(page.getByText("Store style")).toBeVisible();

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

  test("editing a section updates the canvas, and undo reverts it", async ({ page }) => {
    await page.goto("/app/builder");
    await page.click("text=Made slowly");
    await page.fill("#ctrl-heading", "Warm things for cold rooms");

    await expect(page.getByText("Warm things for cold rooms").first()).toBeVisible();
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 20_000 });

    await page.keyboard.press("Control+z");
    await expect(page.getByText("Warm things for cold rooms")).toHaveCount(0);

    await page.keyboard.press("Control+Shift+z");
    await expect(page.getByText("Warm things for cold rooms").first()).toBeVisible();
  });

  test("a newly added section is visible and fillable", async ({ page }) => {
    await page.goto("/app/builder");
    await page.click('button[role="tab"]:has-text("Add")');
    await page.click('button:has-text("FAQ")');

    // An empty FAQ renders nothing on a live storefront, which in the editor
    // made "Add" look like it had done nothing at all.
    await expect(page.getByText("Add a question in the panel")).toBeVisible();

    await page.click("text=Add a question in the panel");
    await page.click('button:has-text("Add question")');
    await page.fill('input[aria-label="Question"]', "Do you post overseas?");
    await page.fill('textarea[aria-label="Answer"]', "Within India only, for now.");
    await expect(page.getByText("Do you post overseas?").first()).toBeVisible();
  });

  test("theme controls actually repaint the canvas", async ({ page }) => {
    await page.goto("/app/builder");
    await expect(page.getByText("Store style")).toBeVisible();

    const headingBefore = await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-storefront] h1")!).fontFamily,
    );

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

  test("publishing makes the draft live, and history records it", async ({ page }) => {
    await page.goto("/app/builder");
    await page.click("text=Made slowly");
    await page.fill("#ctrl-heading", "Warm things for cold rooms");
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 20_000 });

    await page.click('button:has-text("Publish")');
    await expect(page.getByText("Your store is live")).toBeVisible({ timeout: 30_000 });

    await page.goto("/app");
    const slug = (await page.textContent("body"))!.match(/\/s\/([a-z0-9-]+)/)![1]!;

    await page.goto(`/s/${slug}`);
    // updateTag on publish means this is visible immediately, not in five minutes.
    await expect(page.getByText("Warm things for cold rooms").first()).toBeVisible();

    await page.goto("/app/builder");
    await page.click('button[aria-label="Version history"]');
    // Version 1 was created at store creation; this publish is version 2.
    await expect(page.getByText("Version 2")).toBeVisible({ timeout: 15_000 });
  });
});
