import { expect, test, type Page } from "@playwright/test";

import { openBuilderPanel, readVerificationCode, signUpMerchant } from "./support/journey";
import { MAIL_LOG } from "./support/paths";

/*
 * Phase 3: somebody makes an account at a shop.
 *
 * A spec of its own rather than an extension of commerce.spec.ts, for two
 * reasons: that file is already a five-test journey over one merchant page, and
 * this one needs shopper contexts as well as the merchant's — a customer failure
 * reading as a checkout failure would cost more than the duplicated setup does.
 *
 * Codes are read back out of the server's log, which is where the console email
 * and SMS providers print them when neither is configured. playwright.config.ts
 * blanks both, so a developer with real credentials does not have this suite
 * emailing and texting strangers at their own expense.
 */

const PASSWORD = "a-long-enough-password";

test.describe("customer accounts", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  const tag = Date.now().toString(36);
  const merchantEmail = `accounts-${tag}@builderhut.test`;
  const shopperEmail = `shopper-${tag}@builderhut.test`;
  let slug: string;

  test("a merchant opens a shop with one product", async () => {
    await signUpMerchant(page, { name: "Accounts Tester", email: merchantEmail });

    const code = await readVerificationCode(MAIL_LOG, merchantEmail);
    await page.fill('input[aria-label="Digit 1"]', code);
    await page.waitForURL(/\/onboarding/);

    await page.click('button:has-text("Crochet & Yarn")');
    await page.click('button:has-text("Continue")');
    await page.fill("#store-name", `Thread ${tag}`);
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
    await page.click('button[type="submit"]');
    await expect(page.getByText("in your catalogue")).toBeVisible();

    await page.goto("/app");
    slug = (await page.textContent("body"))!.match(/\/s\/([a-z0-9-]+)/)![1]!;
  });

  /*
   * The builder rules. A sign-in form belongs on the sign-in page, only one of
   * it, and the page cannot be left without one.
   */
  test("the builder offers the sign-in form only on its own page", async () => {
    await page.goto("/app/builder");
    await openBuilderPanel(page, "Sections");

    // The three pages are seeded by the template, and marked as system pages.
    await page.click('button:has-text("Pages")');
    await expect(page.getByRole("button", { name: "Open Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Create account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Your account" })).toBeVisible();

    /*
     * The Add panel, on the home page.
     *
     * Asserted through each entry's hint, because those strings appear ONLY in
     * that panel — a section's label also shows on the canvas toolbar, and
     * Playwright matches an accessible name by substring, so "Sign in form"
     * happily matches "Move Sign in form" two panels away.
     *
     * The gallery assertion is the control: without it, a panel that failed to
     * render at all would pass this test.
     */
    await page.click('button:has-text("Add")');
    await expect(page.getByText("A grid of photographs")).toBeVisible();
    await expect(page.getByText("Where returning customers sign in")).toHaveCount(0);
    // And the group heading does not appear on a page it has nothing for.
    await expect(page.getByText("Customer account", { exact: true })).toHaveCount(0);

    // On the sign-in page it is not offered either, because one is already there.
    await page.click('button:has-text("Pages")');
    await page.getByRole("button", { name: "Open Sign in" }).click();
    await page.click('button:has-text("Add")');
    await expect(page.getByText("A grid of photographs")).toBeVisible();
    await expect(page.getByText("Where returning customers sign in")).toHaveCount(0);
  });

  test("the sign-in form cannot be hidden from the page it is for", async () => {
    await page.goto("/app/builder");
    await openBuilderPanel(page, "Sections");
    await page.click('button:has-text("Pages")');
    await page.getByRole("button", { name: "Open Sign in" }).click();
    await page.click('button:has-text("Layers")');

    /*
     * An ordinary section offers an eye; this one does not, the same way the
     * header and footer do not. A sign-in page with the form hidden would be a
     * page with no way to sign in.
     */
    const form = page.locator("li", { hasText: "Sign in form" }).first();
    await expect(form).toBeVisible();
    await expect(form.getByRole("button", { name: /Hide|Show/ })).toHaveCount(0);
  });

  /*
   * A merchant dressing their own sign-in page, and the words landing on the
   * live one — which is the document-driven path rather than the fallback.
   */
  test("a merchant can put their own words on the sign-in page", async () => {
    await page.goto("/app/builder");
    await openBuilderPanel(page, "Sections");
    await page.click('button:has-text("Pages")');
    await page.getByRole("button", { name: "Open Sign in" }).click();

    await page.click('button:has-text("Add")');
    await page.click('button:has-text("Text")');
    await page.getByLabel("Heading").fill("Good to see you again");
    await expect(page.locator("[data-storefront]").getByText("Good to see you again")).toBeVisible({
      timeout: 15_000,
    });

    /*
     * Wait for the save before publishing.
     *
     * The editor saves on a debounce, so clicking Publish straight after typing
     * publishes the draft from before the edit — which is exactly what happened
     * here first time round, and it looked like the storefront ignoring the
     * merchant's words.
     *
     * Exact, because getByText matches a substring and "Saved" also matches
     * "Unsaved changes" — the state on screen the instant anything is typed. The
     * note on the same trap in builder.spec.ts explains what it cost there.
     */
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 20_000 });

    await page.click('button:has-text("Publish")');
    const panel = page.getByRole("dialog", { name: "Publish your shop" });
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Publish my shop" }).click();
    await expect(page.getByText("Your store is live")).toBeVisible({ timeout: 30_000 });
  });

  test("the shop's own sign-in page serves the merchant's layout", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    await expect(visitor.getByText("Good to see you again")).toBeVisible();
    // The document path, not the fallback.
    await expect(visitor.locator("main[data-fallback]")).toHaveCount(0);

    await shopper.close();
  });

  test("a shopper signs up, and the header takes them to their account", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}`);
    // The Account icon in the header, which used to link nowhere at all.
    await visitor.click('a[aria-label="Account"]');
    await visitor.waitForURL(/\/login\?next=/);

    await visitor.goto(`/s/${slug}/signup`);
    await visitor.fill("#customer-name", "Asha Menon");
    await visitor.fill("#customer-identifier", shopperEmail);
    await visitor.fill("#customer-password", PASSWORD);
    await visitor.click('button[type="submit"]:has-text("Create account")');

    await visitor.waitForURL(/\/account$/, { timeout: 25_000 });
    await expect(visitor.locator('nav[aria-label="Your account"]')).toBeVisible();
    await expect(visitor.getByText("Asha Menon")).toBeVisible();

    await shopper.close();
  });

  test("a wrong password says the same thing as an address with no account", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    await visitor.fill("#customer-identifier", shopperEmail);
    await visitor.fill("#customer-password", "definitely-not-it");
    await visitor.click('button[type="submit"]:has-text("Sign in")');

    const refusal = visitor.locator("p[role=alert]").filter({ hasText: /match an account/ });
    await expect(refusal).toBeVisible({ timeout: 20_000 });
    // Nothing about whether the address is known here.
    await expect(refusal).not.toContainText(/exists|registered|unknown|no account/i);

    await shopper.close();
  });

  test("a shopper can sign in with a code instead", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    await visitor.fill("#customer-identifier", shopperEmail);
    await visitor.click('button:has-text("Send me a code instead")');
    await visitor.waitForSelector('input[aria-label="Digit 1"]', { timeout: 20_000 });

    /*
     * One fill for the whole code: it spreads across the six boxes and submits
     * itself, exactly as the merchant flow does. This is also the regression
     * test for a bug where the form posted the code from BEFORE the last
     * keystroke — an empty one — and came back saying it was wrong.
     */
    const code = await readVerificationCode(MAIL_LOG, shopperEmail);
    await visitor.fill('input[aria-label="Digit 1"]', code);
    await visitor.waitForURL(/\/account$/, { timeout: 25_000 });

    await shopper.close();
  });

  test("three wrong guesses burn the code", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    await visitor.fill("#customer-identifier", shopperEmail);
    await visitor.click('button:has-text("Send me a code instead")');
    await visitor.waitForSelector('input[aria-label="Digit 1"]', { timeout: 20_000 });

    const code = await readVerificationCode(MAIL_LOG, shopperEmail);
    const wrong = code === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await visitor.fill('input[aria-label="Digit 1"]', wrong);
      await expect(visitor.locator("p[role=alert]").first()).toBeVisible({ timeout: 20_000 });
      await visitor.waitForTimeout(400);
    }

    // The right code, now spent.
    await visitor.fill('input[aria-label="Digit 1"]', code);
    await visitor.waitForTimeout(2_500);
    expect(visitor.url()).not.toContain("/account");

    await shopper.close();
  });

  test("the account area keeps an address, and checkout prefills from it", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    await visitor.fill("#customer-identifier", shopperEmail);
    await visitor.fill("#customer-password", PASSWORD);
    await visitor.click('button[type="submit"]:has-text("Sign in")');
    await visitor.waitForURL(/\/account$/, { timeout: 25_000 });

    await visitor.goto(`/s/${slug}/account/addresses`);
    await visitor.fill("#addr-name", "Asha Menon");
    await visitor.fill("#addr-line1", "14 Kutcheri Road");
    await visitor.fill("#addr-city", "Chennai");
    await visitor.click('button[type="submit"]:has-text("Save address")');
    await expect(visitor.getByText("14 Kutcheri Road")).toBeVisible({ timeout: 20_000 });
    await expect(visitor.getByText("Used by default")).toBeVisible();

    // And it is there at checkout, without being asked for again.
    await visitor.goto(`/s/${slug}`);
    await visitor.click("text=Lavender throw");
    await visitor.click('button:has-text("Add to basket")');
    /*
     * Wait for the basket to confirm before navigating. Adding is a server
     * action, so leaving the page straight after the click cancels it — and the
     * checkout then redirects to an empty basket, which reads as the prefill
     * having failed rather than the add.
     */
    await expect(visitor.getByText("In your basket")).toBeVisible({ timeout: 20_000 });

    await visitor.goto(`/s/${slug}/checkout`);
    await expect(visitor.locator("#co-email")).toHaveValue(shopperEmail);
    await expect(visitor.locator("#co-line1")).toHaveValue("14 Kutcheri Road");

    await shopper.close();
  });

  test("another customer's order is not theirs to read", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    await visitor.fill("#customer-identifier", shopperEmail);
    await visitor.fill("#customer-password", PASSWORD);
    await visitor.click('button[type="submit"]:has-text("Sign in")');
    await visitor.waitForURL(/\/account$/, { timeout: 25_000 });

    // A well-formed id that is not one of theirs.
    await visitor.goto(`/s/${slug}/account/orders/00000000-0000-7000-8000-000000000000`);
    await expect(visitor.getByText(/couldn't find|not found/i).first()).toBeVisible();

    await shopper.close();
  });

  test("signing out leaves the shop browsable but the account closed", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    await visitor.fill("#customer-identifier", shopperEmail);
    await visitor.fill("#customer-password", PASSWORD);
    await visitor.click('button[type="submit"]:has-text("Sign in")');
    await visitor.waitForURL(/\/account$/, { timeout: 25_000 });

    await visitor.click('button[aria-label="Sign out"]');
    await visitor.waitForTimeout(2_500);

    // The shop is still open to them…
    const store = await visitor.goto(`/s/${slug}`);
    expect(store?.status()).toBe(200);
    // …and the account is not.
    await visitor.goto(`/s/${slug}/account`);
    expect(visitor.url()).toContain("/login");

    await shopper.close();
  });

  /*
   * The merchant's own controls. The free plan does not include mobile sign-in,
   * and the refusal has to name the plan that does — on the server, not only by
   * greying out an option.
   */
  test("mobile sign-in is refused on the free plan, naming the plan that allows it", async () => {
    await page.goto("/app/settings");
    const identifier = page.locator("#customer-identifier-mode");
    await expect(identifier).toBeVisible();

    // The option says which plan it needs.
    await expect(identifier.locator("option[value=phone_only]")).toContainText(/Standard|Pro/);
    await expect(identifier.locator("option[value=phone_only]")).toBeDisabled();

    // And the hint says it too, rather than leaving a dead control unexplained.
    await expect(page.getByText(/Mobile sign-in is part of/)).toBeVisible();
  });

  test("a merchant can change what customers sign in with", async () => {
    await page.goto("/app/settings");
    await page.selectOption("#customer-credential-mode", "code");
    // Codes-only and "don't confirm" contradict each other, so that option goes.
    await expect(page.locator("#customer-verification-mode option[value=off]")).toBeDisabled();

    await page.locator("#customer-credential-mode").scrollIntoViewIfNeeded();
    await page
      .locator("form", { has: page.locator("#customer-credential-mode") })
      .getByRole("button", { name: /^Save$/ })
      .click();
    await expect(page.getByText("Saved.")).toBeVisible({ timeout: 20_000 });
  });

  test("a codes-only shop shows no password field", async ({ browser }) => {
    const shopper = await browser.newContext();
    const visitor = await shopper.newPage();

    await visitor.goto(`/s/${slug}/login`);
    // The shop now signs people in with a code, so there is nothing to type a
    // password into — and the code button is the primary action.
    await expect(visitor.locator("#customer-password")).toHaveCount(0);
    await expect(visitor.getByRole("button", { name: /code/i })).toBeVisible();

    await shopper.close();
  });
});
