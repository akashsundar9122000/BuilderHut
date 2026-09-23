import { expect, test, type Page } from "@playwright/test";

import { readVerificationCode, signUpMerchant } from "./support/journey";
import { MAIL_LOG } from "./support/paths";

/*
 * The journey blueprint section 100 defines, as far as Phase 1 reaches:
 * sign up → verify → onboard → store created → add a product → the public
 * storefront shows it.
 *
 * Runs against a server Playwright builds and starts itself. Its output is
 * redirected to a file so the six-digit codes can be read back: with no SMTP
 * configured the email provider prints them by design (lib/email/provider.ts),
 * which is what makes the whole signup journey testable with no mail account.
 *
 * Every run uses a fresh email and store name: the store address is globally
 * unique, so a fixed name passes once and fails forever after.
 */


test.describe("merchant journey", () => {
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
  const email = `e2e-${tag}@builderhut.test`;
  const storeName = `Thread Bloom ${tag}`;
  let slug: string;

  test("signs up and receives a verification code", async () => {
    await signUpMerchant(page, { name: "Harshini", email });
    await expect(page.getByLabel("Digit 1")).toBeVisible();
  });

  test("verifies, onboards and lands on a live store", async () => {
    const code = await readVerificationCode(MAIL_LOG, email);

    await page.goto(`/verify?email=${encodeURIComponent(email)}`);
    // Typing the whole code into the first box spreads it across the rest.
    await page.fill('input[aria-label="Digit 1"]', code);
    await page.waitForURL(/\/onboarding/);

    await page.click('button:has-text("Crochet & Yarn")');
    await page.click('button:has-text("Continue")');

    await page.fill("#store-name", storeName);
    await expect(page.getByText("That one's free.")).toBeVisible({ timeout: 10_000 });
    await page.click('button:has-text("Continue")');

    await page.click('button:has-text("Instagram")');
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("A full online shop")');
    await page.click('button:has-text("Continue")');
    await page.click('button:has-text("India")');
    await page.click('button:has-text("Continue")');

    await expect(page.getByRole("heading", { name: "Pick a starting point" })).toBeVisible();
    await page.click('button:has-text("Create my store")');

    await page.waitForURL(/\/app/);
    await expect(page.getByText("Get your store ready")).toBeVisible();

    slug = (await page.textContent("body"))!.match(/\/s\/([a-z0-9-]+)/)![1]!;
    expect(slug).toBeTruthy();
  });

  test("adds a product and it appears on the public storefront", async () => {
    await page.goto("/app/products/new");
    await page.fill("#name", "Crochet daisy posy");
    await page.fill("#price", "499");
    await page.fill("#compareAt", "699");
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/app\/products/);
    await expect(page.getByText("Crochet daisy posy")).toBeVisible();

    await page.goto(`/s/${slug}`);
    await expect(page.getByText("Crochet daisy posy")).toBeVisible();
    // Rupees, with Indian digit grouping, from integer minor units.
    await expect(page.getByText("₹499.00").first()).toBeVisible();
    // 499 against a 699 compare-at price.
    await expect(page.getByText("29% off")).toBeVisible();
  });

  test("a signed-out visitor sees the store but not the dashboard", async ({ browser }) => {
    const anon = await browser.newContext();
    const page = await anon.newPage();

    const store = await page.goto(`/s/${slug}`);
    expect(store?.status()).toBe(200);

    await page.goto("/app");
    expect(page.url()).toContain("/login");

    await anon.close();
  });

  test("the storefront does not scroll sideways on a phone", async ({ browser }) => {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await phone.newPage();
    await page.goto(`/s/${slug}`);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows, "a horizontal scrollbar on a phone").toBe(false);

    await phone.close();
  });
});
