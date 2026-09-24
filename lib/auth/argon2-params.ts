/*
 * Argon2id parameters, in a file with no `server-only` on it.
 *
 * Split out from lib/auth/argon2.ts for one reason: that module is
 * `server-only`, which means importing it from an ordinary Node script throws
 * at import time. scripts/db/bootstrap-admin.mts has to produce a hash the
 * running application will later verify, so it needs these numbers — and a
 * second copy of them in the script is exactly the drift the note in argon2.ts
 * warns about. The day the two disagree is the day every hash written by the
 * script stops verifying, with no error to say why.
 *
 * 19 MiB / 2 passes is the OWASP baseline and comfortably within a serverless
 * memory budget. Pinned rather than inherited, so a library bumping its
 * defaults cannot silently invalidate every stored hash.
 */
export const ARGON2_PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
