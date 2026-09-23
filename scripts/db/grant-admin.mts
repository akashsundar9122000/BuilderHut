/*
 * Grant or revoke platform operator access.
 *
 *   pnpm admin:grant someone@example.com
 *   pnpm admin:grant someone@example.com --revoke
 *
 * Deliberately a script rather than a screen, and deliberately not derived from
 * an environment variable of allowed emails. Operator access reads every
 * merchant's business data, so becoming one should be a distinct act somebody
 * performed on purpose, with a row in the audit log saying so — not a side
 * effect of an env var nobody remembers setting.
 *
 * Connects as the OWNER role: is_platform_admin is refused as input by the
 * signup API precisely so it cannot be self-assigned.
 */
import pg from "pg";

const [email, flag] = process.argv.slice(2);
const revoke = flag === "--revoke";

if (!email || !email.includes("@")) {
  console.error("Usage: pnpm admin:grant <email> [--revoke]");
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set.");

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const { rows } = await client.query<{ id: string; name: string }>(
    `UPDATE users SET is_platform_admin = $2 WHERE lower(email) = lower($1) RETURNING id, name`,
    [email, !revoke],
  );

  const user = rows[0];
  if (!user) {
    console.error(`No account found for ${email}. They need to sign up first.`);
    process.exit(1);
  }

  await client.query(
    `INSERT INTO audit_logs (id, actor_id, actor_role, action, entity_type, entity_id, metadata)
     VALUES (gen_random_uuid(), $1, 'platform_admin', $2, 'user', $1, $3)`,
    [
      user.id,
      revoke ? "admin.revoked" : "admin.granted",
      JSON.stringify({ email, by: "grant-admin script" }),
    ],
  );

  console.log(
    revoke
      ? `Revoked operator access from ${email}.`
      : `${user.name} (${email}) is now a platform operator. /admin is open to them.`,
  );
} finally {
  await client.end();
}
