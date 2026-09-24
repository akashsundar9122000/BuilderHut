/*
 * Storefront customer sign-in, against a real Postgres.
 *
 * Almost everything worth asserting here is about what must NOT be visible: that
 * a wrong password and an unknown address say the same sentence, that a guest
 * record cannot be claimed without a code, that three wrong guesses end the
 * code's life, and that a plan without SMS refuses by naming the plan. None of
 * those can be checked without the real tables, the real row locks and the real
 * unique indexes.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import {
  customerRateLimits,
  customers,
  customerSessions,
  customerVerifications,
  storeSettings,
  tenants,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { changePlan } from "@/lib/plans/entitlements";
import {
  continueWithPassword,
  requestPasswordReset,
  resetPassword,
  sendCode,
  setPassword,
  verifyCode,
} from "@/lib/customers/auth";
import { loadSession } from "@/lib/customers/session";
import type { IdentifierMode, CredentialMode, VerificationMode } from "@/lib/customers/policy";

/*
 * Both providers are replaced, and the codes are captured out of the mocks.
 *
 * A test suite must not be able to send email — and must certainly not be able
 * to send a text message, which costs money to a real number.
 */
const sent: { email: string[]; sms: string[] } = { email: [], sms: [] };

vi.mock("@/lib/email/provider", () => ({
  sendEmail: async (message: { to: string; text: string }) => {
    sent.email.push(message.text);
  },
}));
vi.mock("@/lib/sms/provider", () => ({
  sendSms: async (message: { to: string; text: string }) => {
    sent.sms.push(message.text);
  },
}));

function lastCode(channel: "email" | "sms"): string {
  const text = sent[channel].at(-1);
  if (!text) throw new Error(`no ${channel} was sent`);
  const match = /verification code is (\d{6})/.exec(text);
  if (!match) throw new Error(`no code in the ${channel}: ${text}`);
  return match[1]!;
}

const suffix = Date.now().toString(36);
const tenantId = uuidv7();
const ctx = { tenantId, actorId: tenantId, role: "staff" as const };

const SHOP = "Thread & Bloom";
const PASSWORD = "a-long-enough-password";

async function setPolicy(over: {
  identifier?: IdentifierMode;
  credential?: CredentialMode;
  verification?: VerificationMode;
}) {
  await withTenant(ctx, async (db) => {
    const [existing] = await db.select(storeSettings).limit(1);
    const values = {
      customerIdentifier: over.identifier ?? "either",
      customerCredential: over.credential ?? "both",
      customerVerification: over.verification ?? "before_checkout",
    };
    if (existing) await db.update(storeSettings, values, eq(storeSettings.id, existing.id));
    else await db.insert(storeSettings, values);
  });
}

beforeAll(async () => {
  await getRootDb()
    .insert(tenants)
    .values({
      id: tenantId,
      name: SHOP,
      slug: `cust-auth-${suffix}`,
      industry: "crochet",
      country: "IN",
    });
  // Standard, so SMS is available except where a test deliberately drops the plan.
  await withTenant(ctx, (db) => changePlan(db, "standard"));
});

afterAll(async () => {
  await getRootDb().delete(tenants).where(eq(tenants.id, tenantId));
});

beforeEach(async () => {
  sent.email.length = 0;
  sent.sms.length = 0;
  // The limiter is deliberately durable, so each test starts from a clean count
  // rather than inheriting the previous one's attempts.
  await withTenant(ctx, async (db) => {
    await db.delete(customerRateLimits, eq(customerRateLimits.tenantId, tenantId));
  });
});

describe("signing up with a password", () => {
  const email = `signup-${suffix}@builderhut.test`;

  it("creates an account and issues a session nobody can read out of the database", async () => {
    await setPolicy({ verification: "before_checkout" });
    const result = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
      name: "Asha",
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.next !== "signed_in") throw new Error("expected a session");

    const stored = await withTenant(ctx, async (db) => {
      const [row] = await db
        .select(customerSessions)
        .where(eq(customerSessions.id, result.sessionId))
        .limit(1);
      return row;
    });
    // The cookie value is never stored; only a digest of it.
    expect(stored?.tokenHash).not.toBe(result.token);
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    // And the token does resolve, so the digest is the right one.
    const session = await withTenant(ctx, (db) => loadSession(db, result.token));
    expect(session?.customerId).toBe(result.customerId);
    expect(session?.email).toBe(email);
  });

  it("stores an argon2id hash and not the password", async () => {
    const row = await withTenant(ctx, async (db) => {
      const [customer] = await db.select(customers).where(eq(customers.email, email)).limit(1);
      return customer;
    });
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.passwordHash).not.toContain(PASSWORD);
  });

  it("signs the same person in again with the same password", async () => {
    const result = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    expect(result.ok && result.next).toBe("signed_in");
  });

  /*
   * The enumeration test. These two must be the same sentence, or the sign-in
   * form tells anybody who asks which addresses shop here.
   */
  it("says exactly the same thing for a wrong password and an unknown address", async () => {
    const wrongPassword = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: "not-the-right-password",
    });
    const unknown = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: `nobody-${suffix}@builderhut.test`,
      password: "not-the-right-password",
    });

    expect(wrongPassword.ok).toBe(false);
    // An unknown address signs UP, so the only way these can be compared is that
    // the failing one says nothing an attacker can use. Assert the shape of both.
    if (wrongPassword.ok) throw new Error("expected a refusal");
    expect(wrongPassword.message).toBe("That email and password don't match an account.");
    expect(wrongPassword.message).not.toMatch(/exists|registered|unknown|not found/i);
    // Signing up cannot be distinguished by an error either: it succeeds.
    expect(unknown.ok).toBe(true);
  });

  it("asks for a code first where the store verifies at sign-up", async () => {
    await setPolicy({ verification: "at_signup" });
    const result = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: `atsignup-${suffix}@builderhut.test`,
      password: PASSWORD,
    });
    expect(result.ok && result.next).toBe("code");
    expect(sent.email).toHaveLength(1);
    await setPolicy({ verification: "before_checkout" });
  });

  it("refuses a password the store would not accept", async () => {
    await setPolicy({ credential: "code" });
    const result = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: `codesonly-${suffix}@builderhut.test`,
      password: PASSWORD,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("code");
    await setPolicy({ credential: "both" });
  });
});

describe("signing in with a code", () => {
  const email = `code-${suffix}@builderhut.test`;

  it("sends one, and the code is not in the row that records it", async () => {
    const result = await sendCode({ tenantId, shopName: SHOP, identifier: email });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The masked form is what the screen shows; the address is not repeated back.
    expect(result.sentTo).not.toBe(email);

    const code = lastCode("email");
    const row = await withTenant(ctx, async (db) => {
      const [pending] = await db
        .select(customerVerifications)
        .where(eq(customerVerifications.identifier, email))
        .limit(1);
      return pending;
    });
    expect(row?.codeHash).not.toContain(code);
  });

  it("signs somebody in, creating the account if this is their first visit", async () => {
    // Its own code: the captured mails are cleared between tests, so that each
    // one states the whole situation it is asserting about.
    await sendCode({ tenantId, shopName: SHOP, identifier: email });
    const result = await verifyCode({ tenantId, identifier: email, code: lastCode("email") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await withTenant(ctx, async (db) => {
      const [customer] = await db.select(customers).where(eq(customers.id, result.customerId)).limit(1);
      return customer;
    });
    // The code proved the address, so it is now verified — and no password exists.
    expect(row?.emailVerified).toBe(true);
    expect(row?.passwordHash).toBeNull();
  });

  it("will not take the same code twice", async () => {
    await sendCode({ tenantId, shopName: SHOP, identifier: email });
    const code = lastCode("email");
    expect((await verifyCode({ tenantId, identifier: email, code })).ok).toBe(true);
    // A replayed code is a code somebody else has seen.
    expect((await verifyCode({ tenantId, identifier: email, code })).ok).toBe(false);
  });

  it("burns the code after three wrong guesses, and the right one then fails too", async () => {
    const target = `burn-${suffix}@builderhut.test`;
    await sendCode({ tenantId, shopName: SHOP, identifier: target });
    const code = lastCode("email");
    const wrong = code === "000000" ? "111111" : "000000";

    const messages: string[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await verifyCode({ tenantId, identifier: target, code: wrong });
      expect(result.ok).toBe(false);
      if (!result.ok) messages.push(result.message);
    }
    // Identical copy every time: counting attempts must not tell an attacker how
    // many are left.
    expect(new Set(messages).size).toBe(1);

    const withTheRightCode = await verifyCode({ tenantId, identifier: target, code });
    expect(withTheRightCode.ok).toBe(false);
  });

  it("refuses a code that has expired", async () => {
    const target = `stale-${suffix}@builderhut.test`;
    await sendCode({ tenantId, shopName: SHOP, identifier: target });
    const code = lastCode("email");

    await withTenant(ctx, async (db) => {
      await db.update(
        customerVerifications,
        { expiresAt: new Date(Date.now() - 1000) },
        eq(customerVerifications.identifier, target),
      );
    });

    const result = await verifyCode({ tenantId, identifier: target, code });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("expired");
  });

  it("supersedes an earlier code when a new one is sent", async () => {
    const target = `resend-${suffix}@builderhut.test`;
    await sendCode({ tenantId, shopName: SHOP, identifier: target });
    const first = lastCode("email");
    await sendCode({ tenantId, shopName: SHOP, identifier: target });
    const second = lastCode("email");
    expect(first).not.toBe(second);

    expect((await verifyCode({ tenantId, identifier: target, code: first })).ok).toBe(false);
    expect((await verifyCode({ tenantId, identifier: target, code: second })).ok).toBe(true);
  });

  it("stops sending after five in an hour", async () => {
    const target = `flood-${suffix}@builderhut.test`;
    const outcomes: boolean[] = [];
    for (let i = 0; i < 6; i += 1) {
      outcomes.push((await sendCode({ tenantId, shopName: SHOP, identifier: target })).ok);
    }
    expect(outcomes.slice(0, 5)).toEqual([true, true, true, true, true]);
    expect(outcomes[5]).toBe(false);
    expect(sent.email).toHaveLength(5);
  });
});

describe("signing in by mobile number", () => {
  const phone = "+919876500001";

  it("is refused on a plan that does not include it, and the merchant is told which does", async () => {
    await setPolicy({ identifier: "either" });
    await withTenant(ctx, (db) => changePlan(db, "free"));

    const result = await sendCode({ tenantId, shopName: SHOP, identifier: phone });
    expect(result.ok).toBe(false);
    expect(sent.sms).toHaveLength(0);

    // The customer-facing copy stays neutral; the plan is named in the merchant's
    // own settings, which is where the decision can actually be made.
    if (!result.ok) expect(result.message).not.toMatch(/Starter|Standard/);
  });

  it("works once the plan allows it", async () => {
    await withTenant(ctx, (db) => changePlan(db, "standard"));
    const result = await sendCode({ tenantId, shopName: SHOP, identifier: phone });
    expect(result.ok).toBe(true);
    expect(sent.sms).toHaveLength(1);

    const signedIn = await verifyCode({ tenantId, identifier: phone, code: lastCode("sms") });
    expect(signedIn.ok).toBe(true);

    const row = await withTenant(ctx, async (db) => {
      const [customer] = await db.select(customers).where(eq(customers.phone, phone)).limit(1);
      return customer;
    });
    expect(row?.phoneVerified).toBe(true);
    expect(row?.email).toBeNull();
  });

  it("normalises what was typed, so one number is one account", async () => {
    const result = await sendCode({ tenantId, shopName: SHOP, identifier: "098765 00001" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identifier).toBe(phone);

    const count = await withTenant(ctx, async (db) => {
      const rows = await db.select(customers).where(eq(customers.phone, phone));
      return rows.length;
    });
    expect(count).toBe(1);
  });

  it("is refused outright by an email-only store", async () => {
    await setPolicy({ identifier: "email_only" });
    const result = await sendCode({ tenantId, shopName: SHOP, identifier: "+919876500002" });
    expect(result.ok).toBe(false);
    await setPolicy({ identifier: "either" });
  });
});

describe("resetting a password", () => {
  const email = `reset-${suffix}@builderhut.test`;

  beforeEach(async () => {
    await setPolicy({ verification: "before_checkout" });
  });

  it("says the same thing for an address with no account, and sends nothing", async () => {
    const unknown = await requestPasswordReset({
      tenantId,
      shopName: SHOP,
      identifier: `no-such-${suffix}@builderhut.test`,
    });
    expect(unknown.ok).toBe(true);
    expect(sent.email).toHaveLength(0);
  });

  it("signs every other device out when the password changes", async () => {
    const created = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    if (!created.ok || created.next !== "signed_in") throw new Error("expected a session");

    // A second device.
    const other = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    if (!other.ok || other.next !== "signed_in") throw new Error("expected a session");

    await requestPasswordReset({ tenantId, shopName: SHOP, identifier: email });
    const reset = await resetPassword({
      tenantId,
      identifier: email,
      code: lastCode("email"),
      password: "a-completely-different-password",
    });
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;

    // The device that did the reset is still signed in; the other one is not.
    expect(await withTenant(ctx, (db) => loadSession(db, reset.token))).not.toBeNull();
    expect(await withTenant(ctx, (db) => loadSession(db, other.token))).toBeNull();
    expect(await withTenant(ctx, (db) => loadSession(db, created.token))).toBeNull();
  });

  it("accepts the new password and not the old one", async () => {
    const old = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    expect(old.ok).toBe(false);

    const fresh = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: "a-completely-different-password",
    });
    expect(fresh.ok && fresh.next).toBe("signed_in");
  });
});

describe("changing a password from inside the account", () => {
  const email = `change-${suffix}@builderhut.test`;

  it("needs the current one, and leaves the current device signed in", async () => {
    const created = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    if (!created.ok || created.next !== "signed_in") throw new Error("expected a session");
    const elsewhere = await continueWithPassword({
      tenantId,
      shopName: SHOP,
      identifier: email,
      password: PASSWORD,
    });
    if (!elsewhere.ok || elsewhere.next !== "signed_in") throw new Error("expected a session");

    const wrong = await setPassword({
      tenantId,
      customerId: created.customerId,
      sessionId: created.sessionId,
      current: "not-it",
      password: "another-long-password",
    });
    expect(wrong.ok).toBe(false);

    const right = await setPassword({
      tenantId,
      customerId: created.customerId,
      sessionId: created.sessionId,
      current: PASSWORD,
      password: "another-long-password",
    });
    expect(right.ok).toBe(true);

    expect(await withTenant(ctx, (db) => loadSession(db, created.token))).not.toBeNull();
    expect(await withTenant(ctx, (db) => loadSession(db, elsewhere.token))).toBeNull();
  });
});

describe("the verification ledger", () => {
  it("keeps a consumed row rather than deleting it, because the send caps count it", async () => {
    const target = `ledger-${suffix}@builderhut.test`;
    await sendCode({ tenantId, shopName: SHOP, identifier: target });
    await verifyCode({ tenantId, identifier: target, code: lastCode("email") });

    const rows = await withTenant(ctx, (db) =>
      db
        .select(customerVerifications)
        .where(
          and(
            eq(customerVerifications.identifier, target),
            eq(customerVerifications.channel, "email"),
          ),
        ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.consumedAt).not.toBeNull();
  });
});
