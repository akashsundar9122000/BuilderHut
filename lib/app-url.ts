/*
 * Where this deployment lives.
 *
 * One answer, derived in one place, because several things break in quiet
 * ways when they disagree. Better Auth rejects a request whose origin is not
 * its baseURL, which reads to a user as "that email and password don't match
 * an account" — an afternoon went into that one locally. Invitation and
 * reminder emails carry absolute links, and a link to the wrong host is a link
 * to nothing.
 *
 * APP_URL wins when set, because on a custom domain it is the only thing that
 * knows the real answer. Vercel's own variables come next: the stable
 * production host before the per-deployment one, so a preview links to itself
 * and production links to production. Localhost last.
 */
export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // Set by Vercel to the project's stable production hostname, on every
  // deployment including previews — so it is only right for production.
  const production = process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : undefined;
  if (production) return `https://${production}`;

  // The hostname of this specific deployment. Changes every push, which is
  // exactly what a preview wants.
  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}

/** The hostname alone, for deciding whether a request is for BuilderHut itself. */
export function appHost(): string {
  try {
    return new URL(appUrl()).hostname;
  } catch {
    return "localhost";
  }
}

/** True when this deployment is served over HTTPS, which decides cookie flags. */
export function appIsSecure(): boolean {
  return appUrl().startsWith("https://");
}
