import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readVerificationCodeFrom } from "./read-code";

/*
 * The bits of the merchant journey that every spec needs before it can test
 * anything of its own.
 *
 * Signing up is rate limited — deliberately, and correctly — and three journey
 * specs each creating a merchant is enough to reach the limit. A suite that
 * fails because a protection worked is a suite people learn to ignore, so this
 * waits out the window and tries again rather than pretending the limit
 * shouldn't exist.
 */

const SIGNUP_WINDOW_MS = 62_000;

export async function signUpMerchant(
  page: Page,
  { name, email, password = "a-long-enough-password" }: { name: string; email: string; password?: string },
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto("/signup");
    await page.fill("#name", name);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click('button[type="submit"]');

    const limited = page.getByText("Too many requests");
    const result = await Promise.race([
      page.waitForURL(/\/verify/, { timeout: 20_000 }).then(() => "ok" as const),
      limited.waitFor({ timeout: 20_000 }).then(() => "limited" as const),
    ]);

    if (result === "ok") {
      // resend=1 means the send itself failed; the screen would then be waiting
      // for a code that was never issued.
      expect(page.url(), "the verification code was never sent").not.toContain("resend=1");
      return;
    }

    /*
     * Waiting out the window takes longer than a test is allowed by default,
     * so the budget has to grow with the wait — otherwise the retry is killed
     * before it can happen and the limiter looks like a failure again.
     */
    test.setTimeout(test.info().timeout + SIGNUP_WINDOW_MS + 30_000);
    console.log(`[e2e] sign-up rate limited; waiting ${SIGNUP_WINDOW_MS / 1000}s and retrying`);
    await page.waitForTimeout(SIGNUP_WINDOW_MS);
  }

  throw new Error("sign-up was rate limited on every attempt");
}

/**
 * Read a verification code back out of the server's output.
 *
 * With no SMTP and no SMS provider configured, both print the code by design —
 * it is what makes the whole signup journey testable with no mail account and no
 * phone bill. The identifier may therefore be an email address or an E.164
 * mobile number; the match is scoped to it so a parallel spec's code is never
 * picked up, and the LAST match wins because a resend issues a new one.
 */
export async function readVerificationCode(mailLog: string, identifier: string): Promise<string> {
  // Up to 20s: the code is printed from an after() callback, and the server
  // pipes its output through pnpm, so it can lag the browser noticeably.
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const code = readVerificationCodeFrom(readFileSync(mailLog, "utf8"), identifier);
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no verification code was printed for ${identifier}`);
}

/**
 * Open one of the builder's side panels.
 *
 * On a phone they are sheets over a full-screen canvas rather than columns
 * beside it, so the panel and its tabs are not in the document until one is
 * opened. A test that assumes the desktop arrangement fails on the layout
 * working correctly.
 */
export async function openBuilderPanel(
  page: Page,
  which: "Sections" | "Settings" = "Sections",
): Promise<void> {
  const phone = (page.viewportSize()?.width ?? 1280) < 640;
  if (phone) await page.getByRole("button", { name: which, exact: true }).click();
  // Only the section list has tabs; the inspector is a single panel.
  if (which === "Sections") await page.waitForSelector('[role="tablist"]');
  else await page.waitForSelector("text=Store style");
}

/**
 * Close the builder's phone sheet, if one is open.
 *
 * On a phone the sheet covers the top bar, so publishing (or anything else in
 * the chrome) means dismissing it first — which is the layout behaving, not a
 * bug. A no-op at desktop width, where the panels are columns.
 */
export async function closeBuilderPanel(page: Page): Promise<void> {
  const phone = (page.viewportSize()?.width ?? 1280) < 640;
  if (!phone) return;
  const sheet = page.getByRole("dialog");
  if (await sheet.count()) {
    await page.keyboard.press("Escape");
    await sheet.first().waitFor({ state: "detached" });
  }
}
