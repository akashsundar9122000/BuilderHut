/*
 * Create (or re-password) the super-admin account from the environment.
 *
 *   pnpm admin:bootstrap
 *   DATABASE_URL_UNPOOLED="…production…" pnpm admin:bootstrap
 *
 * ── Why this exists alongside admin:grant ─────────────────────────────────
 *
 * `pnpm admin:grant` promotes an account that already signed up. That is the
 * right tool once there are people, and the wrong one for a database with
 * nobody in it: on a fresh production branch there is no first operator, and
 * no way to become one without hand-written SQL.
 *
 * ── Why the credentials are environment variables, and what that costs ────
 *
 * grant-admin.mts argues that operator access should not come from an env var
 * nobody remembers setting, and that argument still holds — which is why this
 * is a command somebody runs on purpose rather than something the application
 * does to itself at startup. The env var supplies the value; the act is still
 * an act, and it still writes an audit row saying so.
 *
 * SUPER_ADMIN_PASSWORD belongs in .env.local and NOT in the deployment's
 * environment. Nothing at runtime reads it — only this script does — so
 * putting it in Vercel would be a plaintext admin password sitting in a
 * dashboard, readable by anyone with project access, in exchange for nothing.
 *
 * Idempotent. Run it again to rotate the password; run it against an existing
 * account to promote that account rather than create a second one.
 *
 * Connects as the OWNER role: is_platform_admin is refused as input by the
 * signup API precisely so it cannot be self-assigned.
 */
import { hash } from "@node-rs/argon2";
import pg from "pg";
import { uuidv7 } from "uuidv7";

import { ARGON2_PARAMS } from "../../lib/auth/argon2-params";

const email = process.env.SUPER_ADMIN_EMAIL?.trim();
const password = process.env.SUPER_ADMIN_PASSWORD;
const name = process.env.SUPER_ADMIN_NAME?.trim() || "Platform operator";

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!email || !password) {
  die(
    "Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env.local first.\n" +
      "See .env.example for the block.",
  );
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) die(`SUPER_ADMIN_EMAIL does not look like an address: ${email}`);

/*
 * The same floor Better Auth enforces on signup (minPasswordLength: 10). A
 * shorter one is accepted here and then rejected at the login screen, which is
 * a confusing way to find out.
 */
if (password.length < 10) die("SUPER_ADMIN_PASSWORD must be at least 10 characters.");

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) die("DATABASE_URL_UNPOOLED or DATABASE_URL must be set.");

/* Which database this is about to change, without printing the credentials in it. */
const target = (() => {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(unparseable connection string)";
  }
})();

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query("BEGIN");

  const existing = await client.query<{ id: string; is_platform_admin: boolean }>(
    `SELECT id, is_platform_admin FROM users WHERE lower(email) = lower($1) FOR UPDATE`,
    [email],
  );

  const found = existing.rows[0];
  const userId = found?.id ?? uuidv7();
  const created = !found;

  if (created) {
    await client.query(
      `INSERT INTO users (id, name, email, email_verified, is_platform_admin, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, now(), now())`,
      [userId, name, email],
    );
  } else {
    /*
     * The address is left exactly as it was. Rewriting it to the casing in the
     * env var would change what the person types to sign in, for no reason.
     * `email_verified` is forced true because there is no inbox round trip
     * here and an unverified operator cannot get past the verify screen.
     */
    await client.query(
      `UPDATE users SET is_platform_admin = true, email_verified = true, updated_at = now() WHERE id = $1`,
      [userId],
    );
  }

  const hashed = await hash(password, ARGON2_PARAMS);

  /*
   * Better Auth stores a password login as an `accounts` row with
   * provider_id 'credential' and account_id equal to the user's id. Writing it
   * in that exact shape is what makes the account signable-in through the
   * ordinary login form rather than only through this script.
   */
  await client.query(
    `INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
     VALUES ($1, $2::uuid, $2::text, 'credential', $3, now(), now())
     ON CONFLICT (provider_id, account_id)
     DO UPDATE SET password = EXCLUDED.password, updated_at = now()`,
    [uuidv7(), userId, hashed],
  );

  await client.query(
    `INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, 'platform_admin', 'admin.bootstrapped', 'user', $2, $3)`,
    [
      uuidv7(),
      userId,
      // The address, never the password — auditLogs' own comment forbids it.
      JSON.stringify({ email, created, by: "admin:bootstrap" }),
    ],
  );

  await client.query("COMMIT");

  console.log(
    `${created ? "Created" : "Updated"} ${email} on ${target}.\n` +
      `  platform operator · email verified · password set\n` +
      `  /admin is open to them at the next sign-in.`,
  );
  if (!created && found && !found.is_platform_admin) {
    console.log("  (this account existed and was NOT an operator; it is now)");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
