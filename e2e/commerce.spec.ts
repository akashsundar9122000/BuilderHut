import { expect, test, type Page } from "@playwright/test";

import { readVerificationCode, signUpMerchant } from "./support/journey";

/*
 * Phase 3: someone buys something.
 *
 * Covers the path blueprint section 100 defines from the customer's side —
 * product page, basket, checkout, payment, confirmation — and the merchant's
 * side of the same order, including the transitions the state machine must
 * refuse and a refund.
 *
 * Needs BH_E2E_MAIL_LOG; see merchant-journey.spec.ts.
 */

const MAIL_LOG = process.env.BH_E2E_MAIL_LOG;

const CARD_GOOD = "4242 4242 4242 4242";
const CARD_DECLINED = "4000 0000 0000 0002";

test.describe("buying something", () => {
  test.skip(!MAIL_LOG, "set BH_E2E_MAIL_LOG to the server's output file");
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
  const email = `commerce-${tag}@builderhut.test`;
  let slug: string;

  test("a merchant opens a shop with one product", async () => {
    await signUpMerchant(page, { name: "Commerce Tester", email });

    const code = await readVerificationCode(MAIL_LOG!, email);
    await page.fill('input[aria-label="Digit 1"]', code);
    await page.waitForURL(/\/onboarding/);

    await page.click('button:has-text("Crochet & Yarn")');
    await page.click('button:has-text("Continue")');
    await page.fill("#store-name", `Nook ${tag}`);
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
    await page.fill("#name", "Lavender throw");
    await page.fill("#price", "2400");
    await page.fill("#compareAt", "2900");
    await page.click('button[type="submit"]');
    await expect(page.getByText("in your catalogue")).toBeVisible();

    await page.goto("/app");
    slug = (await page.textContent("body"))!.match(/\/s\/([a-z0-9-]+)/)![1]!;
  });

  test("a visitor can browse, add to basket and re-price it", async ({ browser }) => {
    const shopper = await browser.newContext();
    const page = await shopper.newPage();

    await page.goto(`/s/${slug}`);
    await page.click("text=Lavender throw");
    await expect(page.getByText("Add to basket")).toBeVisible();

    // Structured data, so a small shop is findable. Blueprint section 21.
    expect(await page.content()).toContain("application/ld+json");
    // 2,400 against a 2,900 compare-at price.
    await expect(page.getByText("17% off")).toBeVisible();

    await page.click('button:has-text("Add to basket")');
    await expect(page.getByText("In your basket")).toBeVisible();

    await page.goto(`/s/${slug}/cart`);
    await expect(page.getByText("₹2,400.00").first()).toBeVisible();

    /*
     * Totals come back from the server, never computed in the browser. A basket
     * showing a figure the server would not agree with only reveals itself at
     * the payment step, which is the worst place to find out.
     */
    await page.click('button[aria-label="More Lavender throw"]');
    await expect(page.getByText("₹4,800.00").first()).toBeVisible({ timeout: 15_000 });

    await shopper.close();
  });

  test("a declined card leaves a payable order, not an empty basket", async ({ browser }) => {
    const shopper = await browser.newContext();
    const page = await shopper.newPage();

    await page.goto(`/s/${slug}`);
    await page.click("text=Lavender throw");
    await page.click('button:has-text("Add to basket")');
    await expect(page.getByText("In your basket")).toBeVisible();

    await page.goto(`/s/${slug}/checkout`);
    await page.fill("#co-name", "Harshini R");
    await page.fill("#co-email", `buyer-${tag}@example.test`);
    await page.fill("#co-phone", "9840000000");
    await page.fill("#co-line1", "12 Bakery Lane");
    await page.fill("#co-city", "Chennai");
    await page.fill("#co-cardNumber", CARD_DECLINED);
    await page.click('button[type="submit"]');

    /*
     * Placing the order closes the basket, so returning to the checkout would
     * show an empty one and look like the whole order had vanished. The
     * customer lands on their unpaid order instead, and pays against it.
     */
    await page.waitForURL(/\/order\//);
    await expect(page.getByText("awaiting payment").first()).toBeVisible();
    await expect(page.getByText("try another card")).toBeVisible();

    await page.fill("#retry-card", CARD_GOOD);
    await page.click('button:has-text("Try this card")');
    await expect(page.getByText("Paid").first()).toBeVisible({ timeout: 20_000 });

    await shopper.close();
  });

  test("the merchant sees the order, advances it, and refunds part of it", async () => {
    await page.goto("/app/orders");
    await expect(page.getByText(`buyer-${tag}@example.test`)).toBeVisible();

    await page.click(`text=buyer-${tag}@example.test`);
    await expect(page.getByText("Lavender throw")).toBeVisible();

    await page.click('button:has-text("Mark being prepared")');
    await expect(page.getByText("Being prepared").first()).toBeVisible();

    // The machine forbids jumping from "being prepared" straight to delivered,
    // so the UI must not offer it.
    await expect(page.getByText("Mark delivered")).toHaveCount(0);

    await page.fill("#refund-amount", "1000");
    await page.fill("#refund-reason", "Arrived marked");
    await page.click('button:has-text("Refund")');
    await expect(page.getByText("Refund recorded")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Partly refunded").first()).toBeVisible();
  });

  test("revenue on the dashboard is net of the refund", async () => {
    await page.goto("/app");
    await expect(page.getByText("Revenue")).toBeVisible();
    // ₹2,400 paid less ₹1,000 refunded.
    await expect(page.getByText("₹1,400.00")).toBeVisible();
  });
});
