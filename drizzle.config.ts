import type { Config } from "drizzle-kit";

/*
 * DDL needs a real session, not a pooled one: drizzle takes an advisory lock
 * around a migration run and PgBouncer cannot hold one across statements. The
 * unpooled URL is also the OWNER role — the app role is deliberately
 * NOBYPASSRLS and has no rights to create tables.
 */
export default {
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
