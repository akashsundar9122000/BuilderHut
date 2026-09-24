import { defineConfig, devices } from "@playwright/test";

import { MAIL_LOG } from "./e2e/support/paths";

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
  /*
   * Twice Playwright's default, for the same reason as the expect timeout:
   * these run against a real Neon database that is usually in another region,
   * and several of them drive a whole merchant journey. A suite that fails on
   * network distance is a suite people learn to ignore.
   */
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 15"] } },
  ],
  webServer: {
    /*
     * Output redirected rather than inherited, so the signup specs can read
     * the verification codes the email provider prints. Readiness is decided
     * by the `url` check below, not by watching stdout, so redirecting it
     * costs nothing.
     */
    command: `pnpm build && pnpm start > ${MAIL_LOG} 2>&1`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    /*
     * Ten minutes, because this includes a full production build. Five was
     * enough on an idle machine and not enough on a busy one, and a harness
     * that gives up on its own build teaches people the suite is unreliable.
     */
    timeout: 600_000,
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
      /*
       * And the same for SMS, with more at stake: a developer with real MSG91 or
       * Twilio credentials in .env.local would otherwise have this suite texting
       * made-up Indian mobile numbers, at their own expense, on every run.
       */
      SMS_PROVIDER: "console",
      MSG91_AUTH_KEY: "",
      MSG91_OTP_TEMPLATE_ID: "",
      TWILIO_ACCOUNT_SID: "",
      TWILIO_AUTH_TOKEN: "",
      TWILIO_FROM: "",
    },
  },
});
