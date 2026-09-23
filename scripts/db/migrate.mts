/*
 * Applies pending migrations as the OWNER role.
 *
 * Never run from application start-up: a cold serverless instance racing another
 * to take the migration lock is how a deploy hangs. This is a deliberate step,
 * run from CI behind approval or by hand.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL must be set.");

if (!process.env.DATABASE_URL_UNPOOLED) {
  console.warn(
    "migrate: DATABASE_URL_UNPOOLED is not set, falling back to the pooled URL. Migrations can hang on a pooled connection — set the direct endpoint.",
  );
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await migrate(drizzle(client), {
    migrationsFolder: path.join(import.meta.dirname, "..", "..", "drizzle", "migrations"),
  });
  console.log("migrate: up to date");
} finally {
  await client.end();
}
