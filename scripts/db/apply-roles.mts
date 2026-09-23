/*
 * Creates/refreshes the NOBYPASSRLS application role. Connects as the owner via
 * DATABASE_URL_UNPOOLED, because role management is not something the app role
 * is allowed to do to itself.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED;
const password = process.env.BUILDERHUT_APP_PASSWORD;

if (!url) throw new Error("DATABASE_URL_UNPOOLED is required (owner role, direct endpoint).");
if (!password || password.length < 16) {
  throw new Error("BUILDERHUT_APP_PASSWORD must be set and at least 16 characters.");
}

const sqlText = readFileSync(
  path.join(import.meta.dirname, "..", "..", "sql", "roles.sql"),
  "utf8",
);

const client = new pg.Client({ connectionString: url });
await client.connect();

const dbName = (await client.query("SELECT current_database() AS db")).rows[0].db as string;

try {
  const statement = sqlText
    .replaceAll("neondb", dbName)
    .replaceAll(":APP_PASSWORD:", password.replaceAll("'", "''"));
  await client.query(statement);
  console.log(`roles: builderhut_app ready on ${dbName} (NOBYPASSRLS, DML only)`);
} finally {
  await client.end();
}
