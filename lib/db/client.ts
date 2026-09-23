import "server-only";

import { neon, neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";

import * as schema from "./schema";

/*
 * Two drivers, chosen from the connection string.
 *
 * Neon in production, over a WebSocket Pool rather than the HTTP driver: the
 * tenancy layer runs every query inside an interactive transaction (it has to —
 * `SET LOCAL app.tenant_id` only survives inside one), and the HTTP driver
 * cannot hold one open.
 *
 * node-postgres locally and in CI, so integration tests can run against a
 * throwaway Postgres without reaching a cloud database per pull request.
 *
 * max: 1 on Neon is deliberate. Serverless fans out to many instances; each one
 * holding a handful of connections exhausts Postgres long before it exhausts
 * anything else. The cost of that choice is that a transaction opened inside
 * another transaction deadlocks against itself — see the guard in tenant.ts.
 */

neonConfig.webSocketConstructor = ws;
// Single statements go over HTTP (no socket handshake); transactions still use the socket.
neonConfig.poolQueryViaFetch = true;

export function isNeonUrl(url: string): boolean {
  return /\.neon\.tech|neon\.build/i.test(url);
}

export type Database = ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzlePg<typeof schema>>;

let cached: Database | undefined;

/**
 * The root connection — unscoped, and therefore not for feature code.
 *
 * Do not import this outside lib/db and lib/jobs. Everything that touches
 * merchant data goes through `withTenant` in ./tenant, which is the only place
 * that sets the tenant context the RLS policies read.
 */
export function getRootDb(): Database {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon pooled URL.",
    );
  }

  if (isNeonUrl(url)) {
    cached = drizzleNeon(new NeonPool({ connectionString: url, max: 1 }), { schema });
  } else {
    cached = drizzlePg(new pg.Pool({ connectionString: url, max: 5 }), { schema });
  }
  return cached;
}

/**
 * Neon returns an array; node-postgres returns `{ rows }`. Raw SQL results have
 * to be unwrapped through this or the same query returns different shapes in
 * production and in tests.
 */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

/** One-shot query helper for migrations and scripts, which need no pool. */
export function sqlClient(url: string) {
  return neon(url);
}
