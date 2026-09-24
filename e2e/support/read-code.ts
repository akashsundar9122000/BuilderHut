/*
 * Reading a one-time code back out of the server's log.
 *
 * Kept separate from journey.ts, which imports Playwright, so that
 * tests/unit/sms-provider.test.ts can run this exact regex against the exact
 * output the console providers print. That coupling is the point: the phrase
 * "verification code is" appears in lib/email/templates.tsx, lib/sms/templates.ts
 * and here, and a copy edit to any of them should fail a one-second unit test
 * rather than time the end-to-end suite out twenty seconds later with a failure
 * that reads like a product bug.
 */

/** A "+" in an E.164 number is a regex quantifier; interpolating one raw throws. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The last code printed for an identifier — an email address or an E.164 number.
 *
 * The last, not the first, so a resend supersedes the code before it.
 */
export function readVerificationCodeFrom(log: string, identifier: string): string | null {
  const match = [
    ...log.matchAll(
      new RegExp(
        `To:\\s+${escapeRegExp(identifier)}[\\s\\S]{0,400}?verification code is (\\d{6})`,
        "g",
      ),
    ),
  ].pop();
  return match?.[1] ?? null;
}
