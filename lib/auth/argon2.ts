import "server-only";

import { hash, verify } from "@node-rs/argon2";

import { ARGON2_PARAMS } from "@/lib/auth/argon2-params";

/*
 * Password hashing, in one place for both identity realms.
 *
 * Argon2id with explicit parameters rather than the library defaults. Pinned
 * because a future version bumping its defaults would silently make every
 * existing hash unverifiable, and because these are values that should be
 * reviewed deliberately rather than inherited. 19 MiB / 2 passes is the OWASP
 * baseline and comfortably within a serverless memory budget.
 *
 * Merchants (lib/auth/merchant.ts, via Better Auth) and storefront customers
 * (lib/customers/auth.ts) share these parameters. Two copies would drift, and
 * the day they drift is the day every hash written under the old ones stops
 * verifying. The numbers themselves live in argon2-params.ts, which carries no
 * `server-only`, so the bootstrap script can hash with them too.
 */
export { ARGON2_PARAMS };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_PARAMS);
}

export function verifyPassword(stored: string, plain: string): Promise<boolean> {
  return verify(stored, plain, ARGON2_PARAMS);
}

/*
 * A real hash of a value nobody knows, verified against when there is no
 * account to verify against.
 *
 * Argon2 is deliberately slow — about 70ms here — so skipping it when the
 * identifier is unknown makes response time a cleaner account oracle than any
 * error message. Callers on a no-account path burn the same time instead.
 *
 * Computed lazily and once: hashing at module load would cost every cold start
 * 70ms whether or not anybody tries to sign in.
 */
let dummy: Promise<string> | null = null;

export function dummyHash(): Promise<string> {
  dummy ??= hash(`no-account-${Math.random()}`, ARGON2_PARAMS);
  return dummy;
}

/** Spend what a real verification would have spent, and always fail. */
export async function burnVerifyTime(plain: string): Promise<false> {
  await verifyPassword(await dummyHash(), plain).catch(() => false);
  return false;
}
