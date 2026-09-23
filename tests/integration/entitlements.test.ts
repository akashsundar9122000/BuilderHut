/*
 * Plan limits, against a real Postgres.
 *
 * This suite exists because of a bug that unit tests could not have found.
 * The usage meters counted rows on the ROOT connection with an explicit
 * tenant filter, which looks correct and reads zero: the app role is
 * NOBYPASSRLS, so a query with no tenant context set returns nothing rather
 * than raising. The plan screen told a shop with four products it had none,
 * and no ceiling could ever fire.
 *
 * So every assertion here counts real rows through the real policies.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import { mediaAssets, products, tenants } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { PLANS } from "@/lib/plans/catalog";
import {
  EntitlementError,
  changePlan,
  limitStates,
  planFor,
  requireCapacity,
  usageFor,
} from "@/lib/plans/entitlements";

const suffix = Date.now().toString(36);
const tenantId = uuidv7();
const ctx = { tenantId, actorId: uuidv7(), role: "owner" as const };

beforeAll(async () => {
  await getRootDb()
    .insert(tenants)
    .values({ id: tenantId, name: "Meter Test", slug: `ent-${suffix}`, industry: "crochet" });

  await withTenant(ctx, async (db) => {
    for (let i = 0; i < 3; i += 1) {
      await db.insert(products, {
        name: `Thing ${i}`,
        slug: `thing-${i}`,
        priceMinor: 10000n,
        currency: "INR",
        status: "active",
      });
    }
    await db.insert(mediaAssets, {
      id: uuidv7(),
      key: `t/${tenantId}/abc.jpg`,
      contentType: "image/jpeg",
      sizeBytes: 2_000_000,
    });
  });
});

afterAll(async () => {
  await getRootDb().delete(tenants).where(eq(tenants.id, tenantId));
});

describe("usage meters", () => {
  it("counts the rows that are actually there", async () => {
    const usage = await withTenant(ctx, (db) => usageFor(db));
    // The regression: this read 0 when the count ran outside a tenant context.
    expect(usage.products).toBe(3);
    expect(usage.storageMb).toBe(2);
  });

  it("does not count another shop's rows", async () => {
    const other = uuidv7();
    await getRootDb()
      .insert(tenants)
      .values({ id: other, name: "Other", slug: `ent-other-${suffix}`, industry: "art" });
    try {
      const usage = await withTenant(
        { tenantId: other, actorId: uuidv7(), role: "owner" },
        (db) => usageFor(db),
      );
      expect(usage.products).toBe(0);
      expect(usage.storageMb).toBe(0);
    } finally {
      await getRootDb().delete(tenants).where(eq(tenants.id, other));
    }
  });
});

describe("ceilings", () => {
  it("allows a write that stays within the plan", async () => {
    await expect(
      withTenant(ctx, (db) => requireCapacity(db, "products", 1)),
    ).resolves.toBeUndefined();
  });

  it("refuses a write that would exceed it, and names the plan that would allow it", async () => {
    const over = PLANS.free.limits.products! + 1;
    await expect(
      withTenant(ctx, (db) => requireCapacity(db, "products", over)),
    ).rejects.toThrow(EntitlementError);

    const error = await withTenant(ctx, (db) =>
      requireCapacity(db, "products", over).catch((e: unknown) => e),
    );
    expect(error).toBeInstanceOf(EntitlementError);
    // A refusal that does not say what would work is a dead end.
    expect((error as EntitlementError).message).toContain(PLANS.standard.name);
  });

  it("never refuses on a plan with no ceiling", async () => {
    await withTenant(ctx, (db) => changePlan(db, "pro"));
    await expect(
      withTenant(ctx, (db) => requireCapacity(db, "products", 10_000)),
    ).resolves.toBeUndefined();
    await withTenant(ctx, (db) => changePlan(db, "free"));
  });
});

describe("changing plan", () => {
  it("moves up and is reflected immediately", async () => {
    await withTenant(ctx, (db) => changePlan(db, "standard"));
    expect((await planFor(tenantId)).id).toBe("standard");
  });

  it("refuses a move down the shop does not fit into", async () => {
    await withTenant(ctx, async (db) => {
      // Fill past Starter's ceiling.
      for (let i = 0; i < PLANS.free.limits.products!; i += 1) {
        await db.insert(products, {
          name: `Filler ${i}`,
          slug: `filler-${i}`,
          priceMinor: 100n,
          currency: "INR",
          status: "draft",
        });
      }
    });

    const result = await withTenant(ctx, (db) => changePlan(db, "free"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // It has to say what to do, not just refuse.
      expect(result.message).toContain("Remove some");
    }
    // And the plan must not have moved.
    expect((await planFor(tenantId)).id).toBe("standard");
  });

  it("reports every meter together for the plan screen", async () => {
    const { plan, meters } = await withTenant(ctx, (db) => limitStates(db));
    expect(plan.id).toBe("standard");
    expect(meters.products.used).toBeGreaterThan(3);
    expect(meters.products.limit).toBe(PLANS.standard.limits.products);
  });
});
