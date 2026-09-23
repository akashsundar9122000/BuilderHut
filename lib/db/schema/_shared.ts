import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

/*
 * Column helpers shared by every table. Three decisions worth the comment:
 *
 * 1. UUIDv7, generated in the application. Time-sortable, so a primary key still
 *    gives B-tree locality on insert; non-sequential, so an order id in a URL
 *    cannot be incremented to find someone else's order; and client-generatable,
 *    which is what makes idempotent retries possible.
 *
 * 2. timestamptz everywhere, always UTC. A store in Chennai and a platform admin
 *    reading the same row must not disagree about when something happened.
 *    Calendar-day grouping is done at query time against the store's timezone.
 *
 * 3. namedTimestamp exists because reusing createdAt() for a second column
 *    silently aliases BOTH TypeScript properties onto the same `created_at`
 *    column — the types stay happy and the data goes to the wrong place.
 */

export const primaryId = () => uuid("id").primaryKey().$defaultFn(uuidv7);

export const namedTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`);

export const createdAt = () => namedTimestamp("created_at");

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date());

export const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() });

/** Money is never a float. Minor units (paise, cents) as bigint, with the currency beside it. */
export const nullableTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
