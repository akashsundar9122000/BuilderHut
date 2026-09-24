import "server-only";

/*
 * The deployment's signing secret.
 *
 * Better Auth takes this for its own session and token signing; the storefront
 * customer realm keys its one-time-code HMAC with it (lib/customers/codes.ts).
 * One secret, one place that decides whether it is good enough, so a deployment
 * cannot end up with a strong secret for merchants and a fallback for
 * customers.
 */
export function appSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters in production.");
  }
  // Development only. Stable so sessions survive a dev-server restart.
  return "builderhut-development-secret-not-for-production-use";
}
