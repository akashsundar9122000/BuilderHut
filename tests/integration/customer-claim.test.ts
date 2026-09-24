/*
 * Claiming a guest record, against a real Postgres.
 *
 * This is the security decision at the centre of storefront accounts, so it gets
 * its own file. recordPayment() has been quietly writing a `customers` row for
 * every guest order since checkout shipped — a shadow ledger holding somebody's
 * email, phone number, delivery address and order history with no password on it.
 *
 * Signing up with that address must therefore not simply hand the row over. It
 * always costs a verified code, whatever the store's verification setting says,
 * and nothing about the record may be visible before that code is accepted.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import {
  customerRateLimits,
  customers,
  orders,
  storeSettings,
  tenants,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { changePlan } from "@/lib/plans/entitlements";
import { continueWithPassword, sendCode, verifyCode } from "@/lib/customers/auth";
import type { VerificationMode } from "@/lib/customers/policy";

/*
 * Both providers are replaced and both are captured. A test suite must not be
 * able to send email, and must certainly not be able to send a text message to a
 * real number at somebody's expense.
 */
const sent: string[] = [];
vi.mock("@/lib/email/provider", () => ({
  sendEmail: async (message: { text: string }) => {
    sent.push(message.text);
  },
}));
vi.mock("@/lib/sms/provider", () => ({
  sendSms: async (message: { text: string }) => {
    sent.push(message.text);
  },
}));

/** The code out of whichever channel it went by — both say the same phrase. */
function lastCode(): string {
  const text = sent.at(-1);
  if (!text) throw new Error("nothing was sent");
  return /verification code is (\d{6})/.exec(text)![1]!;
}

const suffix = Date.now().toString(36);
const tenantId = uuidv7();
const ctx = { tenantId, actorId: tenantId, role: "staff" as const };
const SHOP = "Kiln & Co";
const PASSWORD = "a-long-enough-password";

/** The row recordPayment() leaves behind, and an order pointing at it. */
async function guestWhoOrdered(email: string, phone: string) {
  return withTenant(ctx, async (db) => {
    const [customer] = await db.insert(customers, {
      email,
      phone,
      name: "Padma Iyer",
      // What makes it a guest row rather than an account.
      passwordHash: null,
    });
    const [order] = await db.insert(orders, {
      number: Math.floor(Math.random() * 1_000_000),
      email,
      phone,
      customerId: customer!.id,
      status: "paid",
      currency: "INR",
      subtotalMinor: 250000n,
      totalMinor: 250000n,
      placedAt: new Date(),
      paidAt: new Date(),
    });
    return { customerId: customer!.id, orderId: order!.id };
  });
}

async function setVerification(mode: VerificationMode) {
  await withTenant(ctx, async (db) => {
    const [existing] = await db.select(storeSettings).limit(1);
    // Either identifier, because two of these tests claim by mobile number.
    const values = { customerVerification: mode, customerIdentifier: "either" as const };
    if (existing) await db.update(storeSettings, values, eq(storeSettings.id, existing.id));
    else await db.insert(storeSettings, values);
  });
}

beforeAll(async () => {
  await getRootDb()
    .insert(tenants)
    .values({ id: tenantId, name: SHOP, slug: `claim-${suffix}`, industry: "pottery", country: "IN" });
  // Standard, so signing in by mobile number is available to this shop at all.
  await withTenant(ctx, (db) => changePlan(db, "standard"));
});

afterAll(async () => {
  await getRootDb().delete(tenants).where(eq(tenants.id, tenantId));
});

beforeEach(async () => {
  sent.length = 0;
  await withTenant(ctx, (db) =>
    db.delete(customerRateLimits, eq(customerRateLimits.tenantId, tenantId)),
  );
});

describe("a store that verifies nobody", () => {
  const email = `guest-off-${suffix}@builderhut.test`;
  const phone = "+919876511111";

  beforeAll(async () => {
    await setVerification("off");
  });

  /*
   * The regression test for codeRequiredToClaim(). The store has switched
   * verification off, so a NEW account here is signed in without a code — and
   * this one still is not, because the row already exists.
   */
  it("still demands a code before handing over an existing record", async () => {
    const { customerId } = await guestWhoOrdered(email, phone);

    const attempt = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });

    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.next).toBe("code");
    expect(sent).toHaveLength(1);

    // And the password was not quietly set on the way past.
    const row = await withTenant(ctx, async (db) => {
      const [customer] = await db.select(customers).where(eq(customers.id, customerId)).limit(1);
      return customer;
    });
    expect(row?.passwordHash).toBeNull();
  });

  it("signs a brand-new customer straight in, which is what the setting is for", async () => {
    const result = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: `brand-new-${suffix}@builderhut.test`,
      password: PASSWORD,
    });
    expect(result.ok && result.next).toBe("signed_in");
  });

  it("reveals nothing about the record before the code is accepted", async () => {
    const result = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    if (!result.ok || result.next !== "code") throw new Error("expected a code");

    /*
     * Everything the response carries, as one string. The name, the phone number
     * and the order total must not be anywhere in it — the masked identifier is
     * all the screen needs to say "we sent you a code".
     */
    const visible = JSON.stringify(result);
    expect(visible).not.toContain("Padma");
    expect(visible).not.toContain("9876511111");
    expect(visible).not.toContain("250000");
    /*
     * The identifier itself IS echoed, and has to be: the verify screen needs to
     * know which one the code was for, exactly as the merchant flow's
     * /verify?email= does. It is not a leak — they typed it a moment ago. What
     * the masked `sentTo` protects is the screen, where a shoulder should not
     * learn the whole address.
     */
    expect(result.sentTo).not.toBe(email);
    expect(result.sentTo).toContain("@builderhut.test");
  });

  it("completes the claim once the code is right, and moves no orders", async () => {
    const { customerId, orderId } = await guestWhoOrdered(
      `guest-claim-${suffix}@builderhut.test`,
      "+919876522222",
    );
    const claimEmail = `guest-claim-${suffix}@builderhut.test`;

    const started = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: claimEmail,
      password: PASSWORD,
    });
    if (!started.ok || started.next !== "code") throw new Error("expected a code");

    const before = await withTenant(ctx, async (db) => {
      const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
      return order;
    });

    const finished = await verifyCode({
      tenantId,
      identifier: claimEmail,
      code: lastCode(),
      password: PASSWORD,
    });
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;

    // The same record, not a second one.
    expect(finished.customerId).toBe(customerId);

    const row = await withTenant(ctx, async (db) => {
      const [customer] = await db.select(customers).where(eq(customers.id, customerId)).limit(1);
      return customer;
    });
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.emailVerified).toBe(true);
    // The name they gave the shop at checkout is left alone.
    expect(row?.name).toBe("Padma Iyer");

    /*
     * The order is untouched. Claiming is a permission to SEE history, never a
     * rewrite of it — the row already pointed at this customer, which is exactly
     * why proving the address is enough.
     */
    const after = await withTenant(ctx, async (db) => {
      const [order] = await db.select(orders).where(eq(orders.id, orderId)).limit(1);
      return order;
    });
    expect(after?.customerId).toBe(before?.customerId);
    expect(after?.email).toBe(before?.email);
    expect(after?.totalMinor).toBe(before?.totalMinor);
    expect(after?.status).toBe(before?.status);
  });

  it("does not create a second record for a number already in the ledger", async () => {
    const claimPhone = "+919876533333";
    await guestWhoOrdered(`byphone-${suffix}@builderhut.test`, claimPhone);

    await sendCode({ tenantId, shopName: SHOP, identifier: claimPhone });
    const signedIn = await verifyCode({ tenantId, identifier: claimPhone, code: lastCode() });
    expect(signedIn.ok).toBe(true);

    const rows = await withTenant(ctx, (db) =>
      db.select(customers).where(eq(customers.phone, claimPhone)),
    );
    expect(rows).toHaveLength(1);
  });
});

describe("a code is the only way in", () => {
  it("refuses the wrong code and leaves the record unclaimed", async () => {
    await setVerification("before_checkout");
    const email = `guarded-${suffix}@builderhut.test`;
    const { customerId } = await guestWhoOrdered(email, "+919876544444");

    const started = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    if (!started.ok || started.next !== "code") throw new Error("expected a code");

    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    expect((await verifyCode({ tenantId, identifier: email, code: wrong })).ok).toBe(false);

    const row = await withTenant(ctx, async (db) => {
      const [customer] = await db.select(customers).where(eq(customers.id, customerId)).limit(1);
      return customer;
    });
    expect(row?.passwordHash).toBeNull();
    expect(row?.emailVerified).toBe(false);
  });
});
