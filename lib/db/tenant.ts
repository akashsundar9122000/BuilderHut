import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, getTableName, sql, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";


import { getRootDb, rowsOf } from "./client";
import { classify } from "./schema";

/*
 * The only door to merchant data.
 *
 * Every tenant-owned read and write goes through withTenant(). It opens one
 * transaction, publishes the tenant context into Postgres session settings (the
 * RLS policies read those), and hands back a TenantDb whose query builders
 * inject the tenant predicate for you.
 *
 * The design goal is that forgetting is impossible rather than discouraged:
 *
 *   - select() returns a thenable that adds the predicate at EXECUTION time, so
 *     .where()/.innerJoin()/.orderBy() still compose and there is no terminal
 *     method a caller can omit.
 *   - insert() strips any caller-supplied tenantId and stamps the context one,
 *     so a request body cannot choose which merchant it writes to.
 *   - update() refuses to move a row between tenants, and both update() and
 *     delete() AND the scope into their WHERE.
 *   - A table nobody classified throws instead of returning unscoped rows.
 *
 * SET LOCAL, not SET: the pooled connection is shared, and a plain SET would
 * leak one merchant's tenant id into the next request that borrows the socket.
 */

export type ActorRole = "owner" | "admin" | "manager" | "staff" | "platform_admin";

export interface TenantContext {
  tenantId: string;
  actorId: string;
  role: ActorRole;
}

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

/*
 * Guards against withTenant() inside withTenant().
 *
 * Nesting deadlocks in production and passes locally, which is the worst
 * possible failure shape: the Neon pool is max: 1, so the inner call waits for a
 * connection the outer call is holding and neither ever finishes. Locally the
 * pool is max: 5 and it just works. Throwing makes the mistake loud at the point
 * it is made.
 */
const inTransaction = new AsyncLocalStorage<true>();

type Tx = Parameters<Parameters<ReturnType<typeof getRootDb>["transaction"]>[0]>[0];

export async function withTenant<T>(
  ctx: TenantContext,
  // PromiseLike, not Promise: db.select() returns a thenable so the tenant
  // predicate can be applied at execution time, and `(db) => db.select(t)` has
  // to be a legal body.
  fn: (db: TenantDb) => PromiseLike<T>,
): Promise<T> {
  if (inTransaction.getStore()) {
    throw new TenantScopeError(
      "withTenant() called inside another withTenant(). Nested transactions deadlock against the single-connection pool in production. Pass the existing TenantDb down instead.",
    );
  }
  if (!ctx.tenantId) throw new TenantScopeError("withTenant() requires a tenantId");

  const root = getRootDb();
  return inTransaction.run(true, () =>
    root.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${ctx.tenantId}, true)`);
      await tx.execute(sql`SELECT set_config('app.actor_id', ${ctx.actorId}, true)`);
      await tx.execute(sql`SELECT set_config('app.actor_role', ${ctx.role}, true)`);
      return await fn(new TenantDb(tx as Tx, ctx));
    }),
  );
}

/**
 * Read across every tenant, as the platform operator.
 *
 * This is the one path that steps outside tenant isolation, and it is
 * deliberately narrow:
 *
 *   The RLS policies it relies on are FOR SELECT only, so it can look at
 *   merchant data and cannot quietly edit it.
 *
 *   It refuses without an actor id, so there is no way to reach it from code
 *   that has not established who is asking.
 *
 *   SET LOCAL, so the flag dies with the transaction rather than leaking onto
 *   the pooled connection and into the next request that borrows the socket.
 *
 * Callers must have verified actor.isPlatformAdmin first. Nothing here checks
 * that — this is the mechanism, not the authorization.
 */
export async function withPlatformAdmin<T>(
  actorId: string,
  fn: (tx: Tx) => PromiseLike<T>,
): Promise<T> {
  if (inTransaction.getStore()) {
    throw new TenantScopeError(
      "withPlatformAdmin() called inside another transaction. Nested transactions deadlock against the single-connection pool in production.",
    );
  }
  if (!actorId) {
    throw new TenantScopeError("withPlatformAdmin() requires the id of the admin making the request.");
  }

  const root = getRootDb();
  return inTransaction.run(true, () =>
    root.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.platform_admin', 'on', true)`);
      await tx.execute(sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
      await tx.execute(sql`SELECT set_config('app.actor_role', 'platform_admin', true)`);
      return await fn(tx as Tx);
    }),
  );
}

/**
 * Fully-qualified column reference, for use inside raw SQL.
 *
 * Drizzle renders a bare column name when the statement has no join, so a
 * correlated subquery written the obvious way silently compares a column to
 * itself and returns zero. That failure has no error and no log line; it just
 * reports the wrong number. Use this in every subquery.
 */
export function col(table: PgTable, column: PgColumn): SQL {
  return sql.raw(`"${getTableName(table)}"."${column.name}"`);
}

function tenantColumn(table: PgTable): PgColumn {
  const columns = table as unknown as Record<string, PgColumn>;
  const c = columns["tenantId"];
  if (!c) {
    throw new TenantScopeError(
      `Table "${getTableName(table)}" is TENANT_SCOPED but has no tenantId column.`,
    );
  }
  return c;
}

/**
 * What `db.select(table)` hands back.
 *
 * It is a thenable rather than a query: the tenant predicate is folded in when
 * it is awaited, so a caller's own .where() composes with ours instead of
 * replacing it, and there is no terminal method anyone can forget to call.
 *
 * Joins widen the row type to a record, because the shape then depends on the
 * join and is the caller's business to narrow.
 */
export interface ScopedSelect<Row> extends PromiseLike<Row[]> {
  // SQL | undefined, because drizzle's and()/or() return undefined when every
  // argument is undefined. Accepting it here means callers compose conditions
  // freely instead of asserting non-null at each site.
  where(condition: SQL | undefined): ScopedSelect<Row>;
  orderBy(...columns: unknown[]): ScopedSelect<Row>;
  limit(n: number): ScopedSelect<Row>;
  offset(n: number): ScopedSelect<Row>;
  groupBy(...columns: unknown[]): ScopedSelect<Row>;
  having(condition: SQL | undefined): ScopedSelect<Row>;
  for(strength: "update" | "no key update" | "share" | "key share"): ScopedSelect<Row>;
  innerJoin(table: PgTable, on: SQL): ScopedSelect<Record<string, unknown>>;
  leftJoin(table: PgTable, on: SQL): ScopedSelect<Record<string, unknown>>;
  rightJoin(table: PgTable, on: SQL): ScopedSelect<Record<string, unknown>>;
}

export class TenantDb {
  constructor(
    private readonly tx: Tx,
    readonly ctx: TenantContext,
  ) {}

  /** Throws for PLATFORM tables — reading those through a tenant scope is a category error. */
  private assertScopable(table: PgTable): PgColumn {
    const name = getTableName(table);
    const kind = classify(name);
    if (kind === "platform") {
      throw new TenantScopeError(
        `"${name}" is a PLATFORM table and has no tenant column. Use db.raw and authorize the access explicitly.`,
      );
    }
    return tenantColumn(table);
  }

  private scopeOf(table: PgTable): SQL {
    return eq(this.assertScopable(table), this.ctx.tenantId) as SQL;
  }

  select<T extends PgTable>(table: T): ScopedSelect<T["$inferSelect"]> {
    const scope = this.scopeOf(table);
    const base = this.tx.select().from(table as never);
    return makeScoped<T["$inferSelect"]>(base, scope);
  }

  async insert<T extends PgTable>(
    table: T,
    values: Partial<T["$inferInsert"]> & Record<string, unknown>,
  ): Promise<T["$inferSelect"][]> {
    this.assertScopable(table);
    // Strip, don't trust: a caller-supplied tenantId is either redundant or an attack.
    const { tenantId: _ignored, ...rest } = values;
    return this.tx
      .insert(table as never)
      .values({ ...rest, tenantId: this.ctx.tenantId } as never)
      .returning() as Promise<T["$inferSelect"][]>;
  }

  async insertMany<T extends PgTable>(
    table: T,
    rows: (Partial<T["$inferInsert"]> & Record<string, unknown>)[],
  ): Promise<T["$inferSelect"][]> {
    this.assertScopable(table);
    if (rows.length === 0) return [];
    const stamped = rows.map(({ tenantId: _ignored, ...rest }) => ({
      ...rest,
      tenantId: this.ctx.tenantId,
    }));
    return this.tx
      .insert(table as never)
      .values(stamped as never)
      .returning() as Promise<T["$inferSelect"][]>;
  }

  async update<T extends PgTable>(
    table: T,
    values: Partial<T["$inferInsert"]> & Record<string, unknown>,
    where: SQL,
  ): Promise<T["$inferSelect"][]> {
    const scope = this.scopeOf(table);
    // tenant_id is immutable. A row does not change owner; it is created anew.
    const { tenantId: _ignored, ...rest } = values;
    return this.tx
      .update(table as never)
      .set(rest as never)
      .where(and(scope, where))
      .returning() as Promise<T["$inferSelect"][]>;
  }

  async delete<T extends PgTable>(table: T, where: SQL): Promise<T["$inferSelect"][]> {
    const scope = this.scopeOf(table);
    return this.tx
      .delete(table as never)
      .where(and(scope, where))
      .returning() as Promise<T["$inferSelect"][]>;
  }

  /**
   * Raw SQL inside the tenant transaction. The justification is not decoration:
   * CI greps for these call sites, and a short one fails review.
   */
  async unsafeRaw<T>(justification: string, statement: SQL): Promise<T[]> {
    if (justification.trim().length < 20) {
      throw new TenantScopeError(
        "unsafeRaw() needs a real justification (20+ characters) explaining why the scoped builders cannot express this query.",
      );
    }
    return rowsOf<T>(await this.tx.execute(statement));
  }

  /** The underlying transaction, for PLATFORM tables and cross-table atomicity. */
  get raw(): Tx {
    return this.tx;
  }
}

type DrizzleBuilder = {
  where: (condition: SQL) => PromiseLike<unknown>;
  [key: string]: unknown;
};

function makeScoped<Row>(builder: unknown, scope: SQL): ScopedSelect<Row> {
  let userWhere: SQL | undefined;
  let executed = false;

  /*
   * `wrapped` is declared before the methods that return it and assigned just
   * below. Every method must hand back the PROXY, not this plain target —
   * returning the target broke the chain the moment anything followed a
   * .where(), because the trap that forwards unknown methods to drizzle lives
   * on the proxy alone. `db.select(t).where(x).limit(1)` threw
   * "limit is not a function" in production while the tests, which never
   * chained past .where(), stayed green.
   */
  // Forward-declared because the methods on `target` below close over it and
  // must return the proxy, which cannot exist until `target` does. Assigned
  // exactly once, which is why prefer-const objects — but `const` here would be
  // a use-before-declaration.
  // eslint-disable-next-line prefer-const
  let wrapped: ScopedSelect<Row>;

  const target = {
    where(condition: SQL | undefined) {
      if (condition) {
        userWhere = userWhere ? (and(userWhere, condition) as SQL) : condition;
      }
      return wrapped;
    },
    then(
      onFulfilled?: ((value: Row[]) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) {
      if (executed) {
        throw new TenantScopeError("This scoped query has already been executed.");
      }
      executed = true;
      const final = userWhere ? (and(scope, userWhere) as SQL) : scope;
      return (builder as DrizzleBuilder).where(final).then(
        onFulfilled as (v: unknown) => unknown,
        onRejected as (e: unknown) => unknown,
      );
    },
  } as Record<string, unknown>;

  // orderBy, limit, offset, groupBy, having, innerJoin, for — forwarded to
  // drizzle, with the proxy kept in front so the chain stays scoped.
  wrapped = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      const value = (builder as Record<string, unknown>)[prop];
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        (value as (...a: unknown[]) => unknown).apply(builder, args);
        return wrapped;
      };
    },
  }) as unknown as ScopedSelect<Row>;

  return wrapped;
}
