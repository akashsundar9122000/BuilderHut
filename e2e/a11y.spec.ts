import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/*
 * Blueprint section 52, as a test rather than an intention.
 *
 * Axe finds roughly a third of accessibility problems — it cannot tell whether
 * a heading is meaningful or a tab order makes sense — but the third it finds
 * is the third that is unambiguous and cheap to regress. Contrast is checked
 * separately for the design tokens themselves (scripts/check-contrast.ts) and
 * for the storefront templates (tests/unit/template-contrast.test.ts); this
 * checks them as they are actually combined on a page.
 *
 * Both themes, because a colour that passes on bone can fail on warm black.
 * Both Playwright projects, because the phone is not a narrow desktop: the
 * builder's back link lost its accessible name below `sm` and the save
 * indicator was hidden outright, and neither shows at desktop width.
 */

const EMAIL = process.env.BH_E2E_EMAIL;
const PASSWORD = process.env.BH_E2E_PASSWORD;

/*
 * A published shop to scan, given by slug. Skipped when unset rather than
 * guessed: a storefront renders its own theme from an immutable published
 * snapshot, so what this scans is whatever colours that shop was published
 * with — which is the point, and is not something today's templates can be
 * held responsible for.
 */
const STORE = process.env.BH_E2E_STORE;

/*
 * A platform operator, for the /admin sweep.
 *
 * Separate credentials from BH_E2E_EMAIL because operator access is a
 * different thing from being a merchant, and the merchant account
 * deliberately does not have it — `pnpm admin:bootstrap` makes one of these.
 * Skipped when unset rather than reusing the merchant, which would silently
 * scan a redirect to /app and pass.
 */
const ADMIN_EMAIL = process.env.BH_E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.BH_E2E_ADMIN_PASSWORD;

async function violationsOn(page: Page, url: string, theme: "light" | "dark"): Promise<string[]> {
  /*
   * Reduced motion, then a scroll to the bottom and back.
   *
   * The marketing pages reveal on scroll, so without the scroll everything
   * below the fold is invisible and never checked — and without reduced motion
   * axe catches elements mid-fade and reports the blended colour, which fails
   * differently on every run.
   */
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(url);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(250);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  // One readable line per violation. A serialised axe violation is several
  // screens of DOM, and a failure nobody can read is a failure nobody fixes.
  return results.violations.map(
    (v) =>
      `${url} [${theme}] ${v.id} (${v.impact}): ${v.help}\n      ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(" "))
        .join("\n      ")}`,
  );
}

const PUBLIC_PAGES = [
  "/",
  "/templates",
  /*
   * One template preview. It renders a whole storefront — the real registry,
   * the real theme — inside a marketing page, which is a combination nothing
   * else on the site produces: BuilderHut's chrome and a merchant's palette in
   * one accessibility tree.
   */
  "/templates/thread",
  /*
   * Now a real route. This entry has been here since the suite was written and
   * was quietly sweeping the 404 page, because pricing lived at /#pricing —
   * so the pricing tables, the one screen with money on it, had never actually
   * been checked.
   */
  "/pricing",
  "/login",
  "/signup",
  // The guide. One of each kind of page, because they differ structurally: the
  // front door is a plain column, a group index is a list, and an article is
  // the three-column shell with prose, callouts, steps and a disclosure FAQ.
  "/guide",
  "/guide/start",
  "/guide/start/welcome",
];

test.describe("public surfaces", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`have no axe violations in ${theme}`, async ({ page }) => {
      const found: string[] = [];
      for (const path of PUBLIC_PAGES) found.push(...(await violationsOn(page, path, theme)));
      expect(found.join("\n  "), found.join("\n  ")).toBe("");
    });
  }
});

test.describe("a merchant's storefront", () => {
  test.skip(!STORE, "set BH_E2E_STORE to a published store's slug");

  test("has no axe violations", async ({ page }) => {
    const found: string[] = [];
    // Scanned once rather than per BuilderHut theme: a storefront carries the
    // merchant's palette and ignores ours entirely.
    // The two public account pages are scanned too: a sign-in form is the one
    // place on a shop where a mislabelled field stops somebody buying anything.
    for (const path of ["", "/shop", "/cart", "/login", "/signup"]) {
      found.push(...(await violationsOn(page, `/s/${STORE!}${path}`, "light")));
    }
    expect(found.join("\n  "), found.join("\n  ")).toBe("");
  });
});

const MERCHANT_PAGES = [
  "/app",
  "/app/products",
  "/app/orders",
  "/app/customers",
  "/app/analytics",
  "/app/discounts",
  "/app/domains",
  "/app/marketing",
  "/app/payments",
  "/app/team",
  "/app/plan",
  "/app/settings",
];

test.describe("signed-in surfaces", () => {
  test.skip(!EMAIL || !PASSWORD, "set BH_E2E_EMAIL and BH_E2E_PASSWORD");
  test.describe.configure({ mode: "serial" });

  /*
   * Every page in one test per theme, rather than one test per page.
   *
   * Sign-in is rate limited — correctly — and a test per page meant a dozen
   * logins a minute from one address, which the limiter refused. The failure
   * message names the page, so granularity is not lost where it matters.
   */
  for (const theme of ["light", "dark"] as const) {
    // Eight pages plus the builder, twice over, with a scroll pass on each.
    test.setTimeout(180_000);

    test(`have no axe violations in ${theme}`, async ({ page }) => {
      await page.goto("/login");
      await page.fill("#email", EMAIL!);
      await page.fill("#password", PASSWORD!);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/app/, { timeout: 30_000 });

      const found: string[] = [];
      for (const path of MERCHANT_PAGES) found.push(...(await violationsOn(page, path, theme)));

      /*
       * On a phone eleven of the fifteen sections live behind "More", so the
       * sheet and its links are not in the document until it is opened. Same
       * treatment as the operator console's.
       */
      if ((page.viewportSize()?.width ?? 1280) < 768) {
        await page.goto("/app");
        await page.click('button:has-text("More")');
        await page.waitForSelector('[role="dialog"]', { timeout: 30_000 });

        const sheet = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        for (const v of sheet.violations) {
          found.push(`/app [More sheet] [${theme}] ${v.id} (${v.impact}): ${v.nodes[0]?.target}`);
        }
        await page.keyboard.press("Escape");
      }

      // The builder last: it is the heaviest page and the one whose chrome
      // changes most between widths.
      found.push(...(await violationsOn(page, "/app/builder", theme)));

      /*
       * On a phone the side panels are sheets, so the panel and its tabs are
       * not in the document until one is opened — which is the layout working,
       * not a missing element. Open it, then scan what is actually on screen.
       */
      const phone = (page.viewportSize()?.width ?? 1280) < 640;
      if (phone) await page.click('button:has-text("Sections")');
      await page.waitForSelector('[role="tablist"]', { timeout: 30_000 });
      await page.click('button[role="tab"]:has-text("Assist")');

      const assist = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      found.push(
        ...assist.violations.map(
          (v) =>
            `builder/assist [${theme}] ${v.id} (${v.impact}): ${v.help}\n      ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(" "))
              .join("\n      ")}`,
        ),
      );

      expect(found.join("\n  "), found.join("\n  ")).toBe("");
    });
  }
});

const ADMIN_PAGES = [
  "/admin",
  "/admin/stores",
  "/admin/users",
  "/admin/traffic",
  "/admin/revenue",
  "/admin/domains",
  "/admin/incidents",
  "/admin/audit",
];

test.describe("the operator console", () => {
  test.skip(
    !ADMIN_EMAIL || !ADMIN_PASSWORD,
    "set BH_E2E_ADMIN_EMAIL and BH_E2E_ADMIN_PASSWORD (see pnpm admin:bootstrap)",
  );
  test.describe.configure({ mode: "serial" });

  /*
   * One sign-in for both themes, on a page hoisted out of the tests.
   *
   * Playwright gives every test its own context, so a test per theme meant a
   * sign-in per theme — and with the public sweeps running alongside, that put
   * eight logins a minute on one address. Better Auth rate-limits
   * /sign-in/email at ten, correctly, so the suite started failing at the
   * waitForURL below: not a violation, just the limiter doing its job. Serial
   * mode alone does not fix this; it orders the tests but does not share the
   * session. The page has to be hoisted.
   */
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }, testInfo) => {
    // A hook has its own timeout, and test.setTimeout above does not touch it.
    testInfo.setTimeout(120_000);

    /*
     * An explicit context built from the project's own options, not
     * browser.newPage(). Two reasons: axe refuses to run in the default
     * context it creates, and that context would also drop the project's
     * device emulation — so the "mobile" run would quietly have been a second
     * desktop run passing under a phone's name.
     */
    context = await browser.newContext(testInfo.project.use);
    page = await context.newPage();
    await page.goto("/login");
    await page.fill("#email", ADMIN_EMAIL!);
    await page.fill("#password", ADMIN_PASSWORD!);
    await page.click('button[type="submit"]');

    /*
     * An operator with no shop of their own lands on /app and is then
     * redirected to /admin; one who has a shop stays on /app. So the landing
     * URL is not a reliable signal on its own — go to /admin and wait for
     * something only the signed-in console renders.
     *
     * Deliberately not waitForLoadState("networkidle"): the console streams,
     * and while it is showing "Loading the console" the network never goes
     * idle. That hung the hook for its full minute and reported as an
     * accessibility failure, which it was not.
     */
    await page.waitForURL(/\/(admin|app|onboarding)/, { timeout: 60_000 });

    /*
     * Then wait for the URL to STOP changing, rather than navigating somewhere
     * ourselves. Sign-in here is a chain — /login to /app to /admin — and both
     * earlier attempts raced it: a goto issued while the app's own redirect was
     * in flight fails with "interrupted by another navigation", which reads as
     * an accessibility failure and is nothing of the sort.
     */
    let previous = "";
    await expect
      .poll(
        () => {
          const settled = page.url() === previous;
          previous = page.url();
          return settled;
        },
        { timeout: 30_000, intervals: [500] },
      )
      .toBe(true);

    await page.waitForSelector('button[aria-label="Sign out"]', { timeout: 60_000 });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  /*
   * Denser than the merchant dashboard by design, which is exactly why it
   * needs sweeping: tables, badges and status colours are where contrast and
   * naming problems collect, and nobody outside the company ever sees this
   * console to complain about them.
   */
  for (const theme of ["light", "dark"] as const) {
    /*
     * Eight pages plus the phone's More sheet, each with a scroll pass and an
     * axe run. Three minutes was enough until the sheet was added and then was
     * not, on a machine that happened to be busy — and a timeout here reads as
     * an accessibility failure, which is the most misleading way for a test to
     * go red.
     */
    test.setTimeout(300_000);

    test(`has no axe violations in ${theme}`, async () => {
      const found: string[] = [];
      for (const path of ADMIN_PAGES) found.push(...(await violationsOn(page, path, theme)));

      /*
       * On a phone the sections live behind "More", so the sheet and its links
       * are not in the document until it is opened — which is the layout
       * working, not a missing element. Open it and scan what is on screen,
       * the same way the builder's panels are handled above.
       */
      if ((page.viewportSize()?.width ?? 1280) < 768) {
        await page.goto("/admin");
        await page.click('button:has-text("More")');
        await page.waitForSelector('[role="dialog"]', { timeout: 30_000 });

        const sheet = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        for (const v of sheet.violations) {
          found.push(`/admin [More sheet] [${theme}] ${v.id} (${v.impact}): ${v.nodes[0]?.target}`);
        }
      }

      expect(found.join("\n  "), found.join("\n  ")).toBe("");
    });
  }
});
