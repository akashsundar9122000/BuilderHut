/*
 * Storefront customers, isolated per shop — against a real Postgres.
 *
 * The premise of this whole identity realm is the note at the top of
 * lib/db/schema/customers.ts: the same person may hold an account at a dozen
 * shops on this platform and no merchant is entitled to know about the others.
 * That is a claim about the database, not about intentions, so it is asserted
 * here.
 *
 * The session test is the one to read twice. customer_sessions_token_key is
 * GLOBALLY unique, so a token minted at one shop is a real row that a query at
 * another shop would find if anything ever let it — only the tenant predicate
 * stands between a leaked cookie and somebody else's customer.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb, rowsOf } from "@/lib/db/client";
import {
  customerRateLimits,
  customers,
  customerSessions,
  customerVerifications,
  storeSettings,
  tenants,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { continueWithPassword, sendCode, verifyCode } from "@/lib/customers/auth";
import { loadSession } from "@/lib/customers/session";
import { take } from "@/lib/customers/rate-limit";

const sent: string[] = [];
vi.mock("@/lib/email/provider", () => ({
  sendEmail: async (message: { text: string }) => {
    sent.push(message.text);
  },
}));
vi.mock("@/lib/sms/provider", () => ({ sendSms: async () => {} }));

function lastCode(): string {
  return /verification code is (\d{6})/.exec(sent.at(-1)!)![1]!;
}

const suffix = Date.now().toString(36);
const shopA = uuidv7();
const shopB = uuidv7();
const ctxA = { tenantId: shopA, actorId: shopA, role: "staff" as const };
const ctxB = { tenantId: shopB, actorId: shopB, role: "staff" as const };

/** One person, one address, two unrelated shops. */
const shopper = `same-person-${suffix}@builderhut.test`;
const PASSWORD = "a-long-enough-password";

beforeAll(async () => {
  await getRootDb()
    .insert(tenants)
    .values([
      { id: shopA, name: "Thread & Bloom", slug: `iso-a-${suffix}`, industry: "crochet", country: "IN" },
      { id: shopB, name: "Paper & Press", slug: `iso-b-${suffix}`, industry: "invitations", country: "IN" },
    ]);
  for (const ctx of [ctxA, ctxB]) {
    await withTenant(ctx, (db) => db.insert(storeSettings, { customerVerification: "off" }));
  }
});

afterAll(async () => {
  const db = getRootDb();
  await db.delete(tenants).where(eq(tenants.id, shopA));
  await db.delete(tenants).where(eq(tenants.id, shopB));
});

describe("one address, two shops", () => {
  let sessionAtA = "";
  let sessionAtB = "";
  let customerAtA = "";
  let customerAtB = "";

  it("makes two entirely separate accounts", async () => {
    const atA = await continueWithPassword({
      tenantId: shopA,
      shopName: "Thread & Bloom",
      identifier: shopper,
      password: PASSWORD,
      name: "Asha",
    });
    const atB = await continueWithPassword({
      tenantId: shopB,
      shopName: "Paper & Press",
      identifier: shopper,
      // A different password at each shop, which a shared account could not have.
      password: "a-different-long-password",
      name: "Asha",
    });

    if (!atA.ok || atA.next !== "signed_in") throw new Error("expected a session at A");
    if (!atB.ok || atB.next !== "signed_in") throw new Error("expected a session at B");

    expect(atA.customerId).not.toBe(atB.customerId);
    sessionAtA = atA.token;
    sessionAtB = atB.token;
    customerAtA = atA.customerId;
    customerAtB = atB.customerId;
  });

  it("gives each shop exactly one of them", async () => {
    const atA = await withTenant(ctxA, (db) =>
      db.select(customers).where(eq(customers.email, shopper)),
    );
    const atB = await withTenant(ctxB, (db) =>
      db.select(customers).where(eq(customers.email, shopper)),
    );
    expect(atA).toHaveLength(1);
    expect(atB).toHaveLength(1);
    expect(atA[0]!.id).not.toBe(atB[0]!.id);
  });

  /*
   * The important one. The token is a real, globally-unique row; resolving it in
   * the wrong shop's scope must find nothing.
   */
  it("will not resolve one shop's session at the other", async () => {
    expect(await withTenant(ctxA, (db) => loadSession(db, sessionAtA))).not.toBeNull();
    expect(await withTenant(ctxB, (db) => loadSession(db, sessionAtB))).not.toBeNull();

    expect(await withTenant(ctxB, (db) => loadSession(db, sessionAtA))).toBeNull();
    expect(await withTenant(ctxA, (db) => loadSession(db, sessionAtB))).toBeNull();
  });

  it("will not let one shop read the other's customer by id", async () => {
    const stolen = await withTenant(ctxA, (db) =>
      db.select(customers).where(eq(customers.id, customerAtB)),
    );
    expect(stolen).toHaveLength(0);
    const theOtherWay = await withTenant(ctxB, (db) =>
      db.select(customers).where(eq(customers.id, customerAtA)),
    );
    expect(theOtherWay).toHaveLength(0);
  });

  it("will not let one shop read the other's sessions at all", async () => {
    const rows = await withTenant(ctxA, (db) =>
      db.select(customerSessions).where(eq(customerSessions.customerId, customerAtB)),
    );
    expect(rows).toHaveLength(0);
  });

  it("will not let one shop delete the other's customer", async () => {
    const deleted = await withTenant(ctxA, (db) =>
      db.delete(customers, eq(customers.id, customerAtB)),
    );
    expect(deleted).toHaveLength(0);
    // Still there.
    const survivor = await withTenant(ctxB, (db) =>
      db.select(customers).where(eq(customers.id, customerAtB)),
    );
    expect(survivor).toHaveLength(1);
  });
});

describe("one-time codes", () => {
  const target = `code-iso-${suffix}@builderhut.test`;

  it("cannot be redeemed at a different shop", async () => {
    await sendCode({ tenantId: shopA, shopName: "Thread & Bloom", identifier: target });
    const code = lastCode();

    // The same six digits, at the wrong shop.
    const atB = await verifyCode({ tenantId: shopB, identifier: target, code });
    expect(atB.ok).toBe(false);

    // And still good where it was issued.
    const atA = await verifyCode({ tenantId: shopA, identifier: target, code });
    expect(atA.ok).toBe(true);
  });

  it("is not visible to another shop", async () => {
    await sendCode({ tenantId: shopA, shopName: "Thread & Bloom", identifier: target });
    const rows = await withTenant(ctxB, (db) =>
      db.select(customerVerifications).where(eq(customerVerifications.identifier, target)),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("rate limit counters", () => {
  it("are counted per shop, so one shop cannot spend another's allowance", async () => {
    const subject = `limit-iso-${suffix}@builderhut.test`;
    for (let i = 0; i < 5; i += 1) {
      await withTenant(ctxA, (db) => take(db, "code_send", subject));
    }
    const sixthAtA = await withTenant(ctxA, (db) => take(db, "code_send", subject));
    expect(sixthAtA.ok).toBe(false);

    // Shop B's counter for the same identifier is untouched.
    const firstAtB = await withTenant(ctxB, (db) => take(db, "code_send", subject));
    expect(firstAtB.ok).toBe(true);
  });

  it("are not readable by another shop", async () => {
    const rows = await withTenant(ctxB, (db) =>
      db.select(customerRateLimits).where(eq(customerRateLimits.tenantId, shopA)),
    );
    expect(rows).toHaveLength(0);
  });
});

/*
 * The RLS backstop, in the shape the other security tests use it: with no tenant
 * context at all, the policy matches nothing rather than raising — so a query
 * that forgot its scope returns an empty result instead of everybody's rows.
 */
describe("with no tenant context", () => {
  it("returns zero credential rows to the application role", async () => {
    const db = getRootDb();
    for (const table of ["customer_verifications", "customer_rate_limits", "customer_sessions"]) {
      const rows = rowsOf<{ count: string }>(
        await db.execute(`SELECT count(*)::text AS count FROM "${table}"`),
      );
      expect(rows[0]?.count, table).toBe("0");
    }
  });
});
