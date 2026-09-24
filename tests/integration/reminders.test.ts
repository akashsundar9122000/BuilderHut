/*
 * Unpaid-order reminders, against a real Postgres.
 *
 * The thing that must not happen is a second email. Everything here is
 * arranged around proving that: the mark is written before the send, in an
 * update conditioned on it being absent, so a retried run finds nothing to
 * claim. A test that only checked "an email went out" would pass on the
 * version that sends one every night forever.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import { orders, storeSettings, tenants } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { changePlan } from "@/lib/plans/entitlements";
import { recoveryStats, runUnpaidOrderReminders } from "@/lib/marketing/reminders";

const suffix = Date.now().toString(36);
const tenantId = uuidv7();
const ctx = { tenantId, actorId: tenantId, role: "owner" as const };

const sent: string[] = [];

/*
 * The provider is replaced rather than the transport, so nothing composes a
 * message it then throws away — and so this suite cannot send mail to a real
 * address if somebody's .env.local happens to have SMTP configured.
 */
vi.mock("@/lib/email/provider", () => ({
  sendEmail: async (message: { to: string }) => {
    sent.push(message.to);
  },
}));

/** Six hours ago: past the wait, inside the give-up window. */
function dueAt(): Date {
  return new Date(Date.now() - 6 * 3_600_000);
}

async function makeOrder(
  email: string,
  overrides: { createdAt?: Date; status?: "pending_payment" | "paid" } = {},
): Promise<string> {
  const id = uuidv7();
  await withTenant(ctx, (db) =>
    db.insert(orders, {
      id,
      number: Math.floor(Math.random() * 1_000_000),
      email,
      status: overrides.status ?? "pending_payment",
      currency: "INR",
      subtotalMinor: 100000n,
      totalMinor: 100000n,
      placedAt: overrides.createdAt ?? dueAt(),
    }),
  );
  /*
   * createdAt defaults to now() and the query filters on it, so it has to be
   * moved back — inside the tenant scope, because an update on the root
   * connection matches no rows under RLS and fails silently.
   */
  await withTenant(ctx, (db) =>
    db.update(orders, { createdAt: overrides.createdAt ?? dueAt() }, eq(orders.id, id)),
  );
  return id;
}

beforeAll(async () => {
  await getRootDb()
    .insert(tenants)
    .values({ id: tenantId, name: "Nudge Test", slug: `nudge-${suffix}`, industry: "crochet" });
  // Reminders are a Pro feature.
  await withTenant(ctx, (db) => changePlan(db, "pro"));
});

afterEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  await getRootDb().delete(tenants).where(eq(tenants.id, tenantId));
});

describe("who gets reminded", () => {
  it("nudges an unpaid order that is old enough", async () => {
    const email = `due-${suffix}@example.test`;
    await makeOrder(email);

    const summary = await runUnpaidOrderReminders();
    expect(summary.sent).toBeGreaterThanOrEqual(1);
    expect(sent).toContain(email);
  });

  it("never nudges the same order twice", async () => {
    const email = `once-${suffix}@example.test`;
    await makeOrder(email);

    await runUnpaidOrderReminders();
    expect(sent.filter((to) => to === email)).toHaveLength(1);

    sent.length = 0;
    await runUnpaidOrderReminders();
    // The whole design exists for this assertion.
    expect(sent).not.toContain(email);
  });

  it("leaves an order alone until the wait has passed", async () => {
    const email = `fresh-${suffix}@example.test`;
    await makeOrder(email, { createdAt: new Date(Date.now() - 30 * 60_000) });

    await runUnpaidOrderReminders();
    expect(sent).not.toContain(email);
  });

  it("gives up on one that is too old to be worth an email", async () => {
    const email = `stale-${suffix}@example.test`;
    await makeOrder(email, { createdAt: new Date(Date.now() - 10 * 24 * 3_600_000) });

    await runUnpaidOrderReminders();
    expect(sent).not.toContain(email);
  });

  it("does not nudge an order that was paid for", async () => {
    const email = `paid-${suffix}@example.test`;
    await makeOrder(email, { status: "paid" });

    await runUnpaidOrderReminders();
    expect(sent).not.toContain(email);
  });

  it("respects a shop that has turned them off", async () => {
    await withTenant(ctx, async (db) => {
      const [existing] = await db.select(storeSettings).limit(1);
      if (existing) {
        await db.update(storeSettings, { remindUnpaidOrders: false }, eq(storeSettings.id, existing.id));
      } else {
        await db.insert(storeSettings, { remindUnpaidOrders: false });
      }
    });

    const email = `optout-${suffix}@example.test`;
    await makeOrder(email);
    await runUnpaidOrderReminders();
    expect(sent).not.toContain(email);

    await withTenant(ctx, async (db) => {
      const [existing] = await db.select(storeSettings).limit(1);
      await db.update(storeSettings, { remindUnpaidOrders: true }, eq(storeSettings.id, existing!.id));
    });
  });

  it("does not send for a shop whose plan does not include it", async () => {
    await withTenant(ctx, (db) => changePlan(db, "free"));
    try {
      const email = `noplan-${suffix}@example.test`;
      await makeOrder(email);
      await runUnpaidOrderReminders();
      expect(sent).not.toContain(email);
    } finally {
      await withTenant(ctx, (db) => changePlan(db, "pro"));
    }
  });
});

describe("what the merchant is shown", () => {
  it("counts rows the tenant can actually see", async () => {
    // The regression this guards: counting on the root connection, where RLS
    // returns nothing and every figure reads zero.
    const stats = await recoveryStats(tenantId);
    expect(stats.reminded).toBeGreaterThan(0);
  });

  it("shows nothing for a shop with no orders", async () => {
    const other = uuidv7();
    await getRootDb()
      .insert(tenants)
      .values({ id: other, name: "Empty", slug: `nudge-empty-${suffix}`, industry: "art" });
    try {
      const stats = await recoveryStats(other);
      expect(stats).toEqual({ waiting: 0, reminded: 0, recovered: 0, recoveredMinor: 0 });
    } finally {
      await getRootDb().delete(tenants).where(eq(tenants.id, other));
    }
  });
});
