import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

/*
 * The journey blueprint section 100 defines, as far as Phase 1 reaches:
 * sign up → verify → onboard → store created → add a product → the public
 * storefront shows it.
 *
 * Runs against a built server. Two things it needs from the environment:
 *
 *   BH_E2E_MAIL_LOG  a file the server's stdout is written to, so the six-digit
 *                    code can be read back. Without SMTP configured the code is
 *                    printed there by design (see lib/email/provider.ts), which
 *                    is what makes this testable with no mail account.
 *   APP_URL          must match the port the server is on, or Better Auth
 *                    rejects the request origin as a CSRF attempt.
 *
 * Every run uses a fresh email and store name: the store address is globally
 * unique, so a fixed name passes once and fails forever after.
 */

const MAIL_LOG = process.env.BH_E2E_MAIL_LOG;

test.describe("merchant journey", () => {
  test.skip(!MAIL_LOG, "set BH_E2E_MAIL_LOG to the server's output file");
  test.describe.configure({ mode: "serial" });

  const tag = Date.now().toString(36);
  const email = `e2e-${tag}@builderhut.test`;
  const storeName = `Thread Bloom ${tag}`;
  let slug: string;

  test("signs up and receives a verification code", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#name", "Harshini");
    await page.fill("#email", email);
    await page.fill("#password", "a-long-enough-password");
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/verify/);
    // resend=1 means the send failed; the screen would be waiting for a code
    // that was never issued.
    expect(page.url()).not.toContain("resend=1");
    await expect(page.getByLabel("Digit 1")).toBeVisible();
  });

  test("verifies, onboards and lands on a live store", async ({ page }) => {
    const log = readFileSync(MAIL_LOG!, "utf8");
    const match = [
      ...log.matchAll(
        new RegExp(`To:\\s+${email}[\\s\\S]{0,400}?verification code is (\\d{6})`, "g"),
      ),
    ].pop();
    expect(match, "no verification code was printed for this address").toBeTruthy();

    await page.goto(`/verify?email=${encodeURIComponent(email)}`);
    // Typing the whole code into the first box spreads it across the rest.
    await page.fill('input[aria-label="Digit 1"]', match![1]!);
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

    await expect(page.getByText("Pick a starting point")).toBeVisible();
    await page.click('button:has-text("Create my store")');

    await page.waitForURL(/\/app/);
    await expect(page.getByText("Get your store ready")).toBeVisible();

    slug = (await page.textContent("body"))!.match(/\/s\/([a-z0-9-]+)/)![1]!;
    expect(slug).toBeTruthy();
  });

  test("adds a product and it appears on the public storefront", async ({ page }) => {
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
