/*
 * Proves tenant isolation against a real Postgres — both layers of it.
 *
 * These are the tests that matter most in the product. A bug anywhere else
 * shows a wrong number; a bug here shows one merchant another merchant's
 * orders. They run against DATABASE_URL, which in development is the Neon dev
 * branch connected as the NOBYPASSRLS app role.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import { withTenant, TenantScopeError } from "@/lib/db/tenant";
import { products, tenants } from "@/lib/db/schema";

const suffix = Date.now().toString(36);
const tenantA = uuidv7();
const tenantB = uuidv7();

const ctxA = { tenantId: tenantA, actorId: uuidv7(), role: "owner" as const };
const ctxB = { tenantId: tenantB, actorId: uuidv7(), role: "owner" as const };

beforeAll(async () => {
  const db = getRootDb();
  await db.insert(tenants).values([
    { id: tenantA, name: "Thread & Bloom", slug: `rls-a-${suffix}`, industry: "crochet" },
    { id: tenantB, name: "Paper & Press", slug: `rls-b-${suffix}`, industry: "invitations" },
  ]);
});

afterAll(async () => {
  const db = getRootDb();
  // products cascade from tenants
  await db.delete(tenants).where(eq(tenants.id, tenantA));
  await db.delete(tenants).where(eq(tenants.id, tenantB));
});

describe("tenant isolation", () => {
  it("scopes reads to the tenant in context", async () => {
    await withTenant(ctxA, (db) =>
      db.insert(products, {
        name: "Crochet daisy",
        slug: "crochet-daisy",
        priceMinor: 49900n,
        currency: "INR",
        status: "active",
      }),
    );
    await withTenant(ctxB, (db) =>
      db.insert(products, {
        name: "Foil invitation",
        slug: "foil-invitation",
        priceMinor: 12000n,
        currency: "INR",
        status: "active",
      }),
    );

    const seenByA = await withTenant(ctxA, (db) => db.select(products));
    const seenByB = await withTenant(ctxB, (db) => db.select(products));

    expect(seenByA.map((p) => p.name)).toEqual(["Crochet daisy"]);
    expect(seenByB.map((p) => p.name)).toEqual(["Foil invitation"]);
  });

  it("cannot reach another tenant's row by id", async () => {
    const [bRow] = await withTenant(ctxB, (db) => db.select(products));
    expect(bRow).toBeDefined();

    const stolen = await withTenant(ctxA, (db) =>
      db.select(products).where(eq(products.id, bRow!.id)),
    );
    expect(stolen).toEqual([]);
  });

  it("ignores a caller-supplied tenantId on insert", async () => {
    // The shape of a forged request body: claim to be writing for tenant B
    // while authenticated as tenant A.
    const [written] = await withTenant(ctxA, (db) =>
      db.insert(products, {
        tenantId: tenantB,
        name: "Forged",
        slug: "forged",
        priceMinor: 100n,
        currency: "INR",
      }),
    );
    expect((written as { tenantId: string }).tenantId).toBe(tenantA);
  });

  it("refuses to move a row to another tenant", async () => {
    const [row] = await withTenant(ctxA, (db) =>
      db.select(products).where(eq(products.slug, "forged")),
    );
    await withTenant(ctxA, (db) =>
      db.update(products, { tenantId: tenantB, name: "Renamed" }, eq(products.id, row!.id)),
    );
    const stillA = await withTenant(ctxA, (db) =>
      db.select(products).where(eq(products.id, row!.id)),
    );
    expect(stillA).toHaveLength(1);
    expect(stillA[0]!.name).toBe("Renamed");
  });

  it("cannot delete across tenants", async () => {
    const [bRow] = await withTenant(ctxB, (db) => db.select(products));
    const deleted = await withTenant(ctxA, (db) =>
      db.delete(products, eq(products.id, bRow!.id)),
    );
    expect(deleted).toEqual([]);

    const survives = await withTenant(ctxB, (db) => db.select(products));
    expect(survives).toHaveLength(1);
  });
});

describe("RLS backstop", () => {
  it("returns zero rows when no tenant context is set", async () => {
    // Deliberately bypassing withTenant — this is the shape of the bug RLS
    // exists to contain. As a NOBYPASSRLS role with app.tenant_id unset, the
    // policy matches nothing.
    const db = getRootDb();
    const result = await db.execute(sql`SELECT count(*)::int AS n FROM products`);
    const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
    expect((rows[0] as { n: number }).n).toBe(0);
  });

  it("confirms the app role cannot bypass RLS", async () => {
    const db = getRootDb();
    const result = await db.execute(
      sql`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`,
    );
    const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
    expect(rows[0]).toMatchObject({ rolbypassrls: false, rolsuper: false });
  });
});

describe("guard rails", () => {
  it("throws when withTenant is nested", async () => {
    await expect(
      withTenant(ctxA, async () => {
        await withTenant(ctxA, async () => "never reached");
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it("throws when a PLATFORM table is queried through the tenant scope", async () => {
    await expect(withTenant(ctxA, async (db) => db.select(tenants))).rejects.toThrow(
      /PLATFORM table/,
    );
  });

  it("rejects unsafeRaw without a real justification", async () => {
    await expect(
      withTenant(ctxA, async (db) => db.unsafeRaw("because", sql`SELECT 1`)),
    ).rejects.toThrow(/justification/);
  });
});

describe("scoped query chaining", () => {
  /*
   * The scoped select is a proxy, and a proxy that stops proxying mid-chain is
   * worse than none: it throws only for the combinations nobody wrote a test
   * for. `.where().limit()` reached production and failed there, so every
   * shape the codebase actually uses is exercised here.
   */
  it("survives .where().orderBy().limit()", async () => {
    const rows = await withTenant(ctxA, (db) =>
      db
        .select(products)
        .where(eq(products.status, "active"))
        .orderBy(products.createdAt)
        .limit(5),
    );
    expect(Array.isArray(rows)).toBe(true);
  });

  it("survives .orderBy().where() in the other order", async () => {
    const rows = await withTenant(ctxA, (db) =>
      db.select(products).orderBy(products.createdAt).where(eq(products.status, "active")),
    );
    expect(Array.isArray(rows)).toBe(true);
  });

  it("still scopes to the tenant after a chain", async () => {
    // The chain must not lose the tenant predicate on the way through.
    const mine = await withTenant(ctxA, (db) =>
      db.select(products).where(eq(products.status, "active")).limit(50),
    );
    for (const row of mine) expect(row.tenantId).toBe(tenantA);
  });

  it("combines a caller's where with the tenant scope rather than replacing it", async () => {
    const none = await withTenant(ctxA, (db) =>
      db.select(products).where(eq(products.slug, "foil-invitation")).limit(10),
    );
    // That slug belongs to tenant B. Filtering for it as A must find nothing.
    expect(none).toEqual([]);
  });
});
