import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  /*
   * Longer than Playwright's 5s default, because these run against a real
   * Neon database that is usually in a different region from whoever is
   * running them — about 78ms per round trip from here. A single "add to
   * basket" is a handful of those, and a suite that fails on network distance
   * teaches people to ignore it.
   */
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      // The origin must match or Better Auth rejects requests as CSRF.
      APP_URL: `http://localhost:${PORT}`,
      /*
       * SMTP is deliberately blanked so the email provider falls back to
       * printing verification codes, which is how the suite reads them back.
       * Without this, a developer with real SMTP configured would have the
       * codes sent to a non-existent @builderhut.test address instead.
       */
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
    },
  },
});
