import { expect, test, type Page } from "@playwright/test";

import { openBuilderPanel, readVerificationCode, signUpMerchant } from "./support/journey";
import { MAIL_LOG } from "./support/paths";

/* TEMPORARY probe — drives the real Preview button, not the route. */

test.describe("probe", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }) => { page = await browser.newPage(); });
  test.afterAll(async () => { await page.close(); });

  const tag = Date.now().toString(36);
  const email = `probe-${tag}@builderhut.test`;

  test("hero edit, live canvas, real Preview button", async () => {
    test.setTimeout(180_000);
    await signUpMerchant(page, { name: "Probe", email });
    const code = await readVerificationCode(MAIL_LOG, email);
    await page.fill('input[aria-label="Digit 1"]', code);
    await page.waitForURL(/\/onboarding/);

    // Home & decor -> the hearth template the user is on.
    await page.click('button:has-text("Home Decor")');
    await page.click('button:has-text("Continue")');
    await page.fill("#store-name", `Test ${tag}`);
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

    await page.goto("/app/builder");

    /*
     * Slow the save down to what a real round trip to bom1 + Singapore looks
     * like from a laptop in India, then type while one is in flight.
     */
    await page.route("**/app/builder", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((r) => setTimeout(r, 1500));
      }
      await route.continue();
    });

    await openBuilderPanel(page);
    await page.click('button[role="tab"]:has-text("Layers")');
    await page.click('button:has-text("Hero")');

    // First half: triggers an autosave 1.2s later.
    await page.fill("#ctrl-heading", "FIRST HALF");
    await page.waitForTimeout(1600);          // the save is now in flight
    await page.fill("#ctrl-heading", "FIRST HALF AND SECOND HALF");
    await page.waitForTimeout(6000);          // plenty of time for any save

    console.log("[probe] canvas h1:", await page.locator("[data-storefront] h1").first().innerText());
    console.log("[probe] status:", JSON.stringify(await page.locator('[role="status"]').allInnerTexts()));

    await page.unroute("**/app/builder");
    await page.reload();
    console.log("[probe] canvas h1 AFTER RELOAD:",
      await page.locator("[data-storefront] h1").first().innerText());
  });
});
