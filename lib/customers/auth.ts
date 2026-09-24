import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { burnVerifyTime, hashPassword, verifyPassword } from "@/lib/auth/argon2";
import { customers, customerVerifications } from "@/lib/db/schema";
import { withTenant, type TenantDb } from "@/lib/db/tenant";
import { customerCodeEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/provider";
import { sendSms } from "@/lib/sms/provider";
import { verificationCodeSms } from "@/lib/sms/templates";
import { attachCartToCustomer } from "@/lib/commerce/cart";
import { CODE_MINUTES, MAX_ATTEMPTS, codeExpiry, codesMatch, generateCode, hashCode } from "./codes";
import { maskEmail, maskPhone } from "./phone";
import {
  checkIdentifier,
  codeRequiredAtSignup,
  codeRequiredToClaim,
  codesAllowed,
  passwordsAllowed,
  readPolicy,
  type CustomerPolicy,
  type IdentifierKind,
} from "./policy";
import { createSession, revokeAllSessions } from "./session";
import { checkSmsAllowed, clear, take } from "./rate-limit";

/*
 * Signing a customer in to one merchant's shop.
 *
 * Every exported function here opens exactly ONE transaction and does all of its
 * work inside it: the rate limit, the lookup, the argon2 verify, the session
 * insert. Cookies are written by the caller afterwards, because a cookie cannot
 * be set once rendering has begun and because holding the single pooled
 * connection open across a network call to an SMS provider is how a shop stops
 * responding.
 *
 * TWO RULES, both easy to break and both silent when broken.
 *
 * 1. Never throw after take(). An exception escaping withTenant() rolls the
 *    attempt counter back with everything else, and a limiter that forgets
 *    failed attempts is not a limiter. Every path below returns a result.
 *
 * 2. Never say whether an identifier has an account. Three states have to look
 *    identical from outside: the identifier is free, it belongs to a real
 *    account, and it belongs to an unclaimed guest row that recordPayment() left
 *    behind. A sign-up that says "already registered" is one half of an
 *    enumeration oracle and a sign-in that says "no account" is the other, which
 *    is why sign-up and sign-in are one function here rather than two.
 */

export type AuthField = "identifier" | "password" | "code" | "name";

export type AuthFailure = {
  ok: false;
  message: string;
  field?: AuthField;
  retryAfterSeconds?: number;
};

/** A session exists. The CALLER writes the cookie, after the transaction. */
export type SignedIn = {
  ok: true;
  next: "signed_in";
  customerId: string;
  sessionId: string;
  token: string;
  /** Set when a guest cart was merged and the cart cookie must be repointed. */
  cartToken?: string | null;
};

/** A code is in flight. `sentTo` is masked — never the address itself. */
export type CodeSent = {
  ok: true;
  next: "code";
  channel: "email" | "sms";
  identifier: string;
  sentTo: string;
  expiresInMinutes: number;
};

export type AuthResult = SignedIn | CodeSent | AuthFailure;

/** What the caller must do after the transaction: send this, set that. */
interface Outbox {
  code?: { channel: "email" | "sms"; to: string; code: string; shopName: string };
}

/*
 * The same sentence for "no account with that address" and "wrong password".
 *
 * Lifted deliberately from components/auth/SignInForm.tsx, which says the same
 * thing for the same reason on the merchant side.
 */
function credentialsRefused(kind: IdentifierKind): AuthFailure {
  return {
    ok: false,
    field: "password",
    message:
      kind === "phone"
        ? "That number and password don't match an account."
        : "That email and password don't match an account."
  };
}

function maskFor(kind: IdentifierKind, identifier: string): string {
  return kind === "phone" ? maskPhone(identifier) : maskEmail(identifier);
}

async function findByIdentifier(
  db: TenantDb,
  kind: IdentifierKind,
  identifier: string,
): Promise<typeof customers.$inferSelect | undefined> {
  const rows =
    kind === "email"
      ? await db
          .select(customers)
          .where(and(sql`lower(${customers.email}) = ${identifier}`, isNull(customers.deletedAt)))
          .limit(1)
      : await db
          .select(customers)
          .where(and(eq(customers.phone, identifier), isNull(customers.deletedAt)))
          .limit(1);
  return rows[0];
}

/**
 * Put a code in flight.
 *
 * Any code still live for this identifier and purpose is consumed first, so a
 * resend supersedes rather than leaving two working codes. Rows are consumed
 * rather than deleted because they are also the ledger the send caps count.
 */
async function issueCode(
  db: TenantDb,
  args: {
    identifier: string;
    kind: IdentifierKind;
    purpose: "signup" | "login" | "claim" | "verify" | "password_reset";
    customerId?: string | null;
    ip?: string | null;
  },
): Promise<string> {
  const code = generateCode();
  await db.update(
    customerVerifications,
    { consumedAt: new Date() },
    and(
      eq(customerVerifications.identifier, args.identifier),
      isNull(customerVerifications.consumedAt),
    )!,
  );
  await db.insert(customerVerifications, {
    identifier: args.identifier,
    channel: args.kind === "phone" ? "sms" : "email",
    purpose: args.purpose,
    codeHash: hashCode(code),
    expiresAt: codeExpiry(),
    customerId: args.customerId ?? null,
    ipAddress: args.ip ?? null,
  });
  return code;
}

/** Both send caps, plus the plan gate when it is going out by SMS. */
async function reserveSend(
  db: TenantDb,
  kind: IdentifierKind,
  identifier: string,
): Promise<{ ok: true } | AuthFailure> {
  if (kind === "phone") {
    const sms = await checkSmsAllowed(db);
    if (!sms.ok) {
      return { ok: false, field: "identifier", message: sms.message, retryAfterSeconds: sms.retryAfterSeconds };
    }
  }

  const perIdentifier = await take(db, "code_send", identifier);
  if (!perIdentifier.ok) {
    return {
      ok: false,
      field: "identifier",
      message: perIdentifier.message,
      retryAfterSeconds: perIdentifier.retryAfterSeconds,
    };
  }

  const perStore = await take(db, kind === "phone" ? "sms_send_store" : "email_send_store", "store");
  if (!perStore.ok) {
    return {
      ok: false,
      field: "identifier",
      message: perStore.message,
      retryAfterSeconds: perStore.retryAfterSeconds,
    };
  }
  return { ok: true };
}

/** Deliver whatever the transaction decided to send. Never inside the transaction. */
async function flush(outbox: Outbox, shopName: string): Promise<void> {
  const pending = outbox.code;
  if (!pending) return;
  if (pending.channel === "sms") {
    await sendSms(verificationCodeSms(pending.to, pending.code, CODE_MINUTES, shopName));
  } else {
    await sendEmail(customerCodeEmail(pending.to, pending.code, CODE_MINUTES, shopName));
  }
}

export interface AuthRequest {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Continue with a password: sign in, or sign up, whichever this turns out to be.
 *
 * Three branches, indistinguishable from outside except where they cannot be:
 *
 *  1. No row        → create the account. A code first if the store verifies at
 *                     sign-up, otherwise straight in.
 *  2. Has a password → verify it.
 *  3. Has NO password → an unclaimed guest row. The password is ignored entirely
 *                     and a claim code goes out, because that row may already
 *                     hold somebody's orders, address and phone number.
 *
 * Branch 3 is where the one residual oracle lives, and it is worth naming rather
 * than hiding: at a store that does not verify at sign-up, branch 1 signs you in
 * and branch 3 asks for a code, so "we sent you a code" reveals that this
 * identifier has shopped HERE before. One bit, about the single shop the visitor
 * is already standing in, with the order history still behind the code — against
 * the alternative of charging every new customer an email round trip the merchant
 * switched off. It is rate limited so it cannot be run down a list, and nothing
 * about it is logged.
 */
export async function continueWithPassword(input: {
  tenantId: string;
  shopName: string;
  identifier: string;
  password: string;
  name?: string;
  acceptsMarketing?: boolean;
  request?: AuthRequest;
  /** The visitor's cart cookie, so the merge happens in this transaction. */
  cartToken?: string | null;
}): Promise<AuthResult> {
  const outbox: Outbox = {};
  const result = await withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<AuthResult> => {
      const policy = await readPolicy(db);
      if (!passwordsAllowed(policy)) {
        return {
          ok: false,
          field: "password",
          message: "This shop signs people in with a code rather than a password.",
        };
      }

      const checked = checkIdentifier(policy, input.identifier);
      if (!checked.ok) return { ok: false, field: "identifier", message: checked.message };
      const { kind, normalized } = checked;

      if (input.password.length < 10) {
        return { ok: false, field: "password", message: "Use at least 10 characters." };
      }

      const limit = await take(db, "password_attempt", normalized);
      if (!limit.ok) {
        return {
          ok: false,
          field: "password",
          message: limit.message,
          retryAfterSeconds: limit.retryAfterSeconds,
        };
      }

      const existing = await findByIdentifier(db, kind, normalized);

      /* 2. A real account. */
      if (existing?.passwordHash) {
        const good = await verifyPassword(existing.passwordHash, input.password).catch(() => false);
        if (!good) return credentialsRefused(kind);

        await clear(db, "password_attempt", normalized);
        const session = await createSession(db, existing.id, input.request);
        const cartToken = await attachCartToCustomer(db, existing.id, input.cartToken ?? null);
        return {
          ok: true,
          next: "signed_in",
          customerId: existing.id,
          sessionId: session.sessionId,
          token: session.token,
          cartToken,
        };
      }

      /* 3. A guest row waiting to be claimed. Always a code — see codeRequiredToClaim. */
      if (existing) {
        codeRequiredToClaim();
        // Spend what a verify would have, so timing does not distinguish this
        // from branch 2.
        await burnVerifyTime(input.password);
        const send = await reserveSend(db, kind, normalized);
        if (!send.ok) return send;

        const code = await issueCode(db, {
          identifier: normalized,
          kind,
          purpose: "claim",
          customerId: existing.id,
          ip: input.request?.ip,
        });
        outbox.code = { channel: kind === "phone" ? "sms" : "email", to: normalized, code, shopName: input.shopName };
        return {
          ok: true,
          next: "code",
          channel: kind === "phone" ? "sms" : "email",
          identifier: normalized,
          sentTo: maskFor(kind, normalized),
          expiresInMinutes: CODE_MINUTES,
        };
      }

      /* 1. Nobody here yet. */
      await burnVerifyTime(input.password);
      const name = input.name?.trim() || null;
      const [created] = await db.insert(customers, {
        email: kind === "email" ? normalized : null,
        phone: kind === "phone" ? normalized : null,
        name,
        passwordHash: await hashPassword(input.password),
        acceptsMarketing: input.acceptsMarketing ?? false,
      });
      if (!created) {
        return { ok: false, message: "We couldn't create that account. Please try again." };
      }

      if (codeRequiredAtSignup(policy)) {
        const send = await reserveSend(db, kind, normalized);
        if (!send.ok) return send;
        const code = await issueCode(db, {
          identifier: normalized,
          kind,
          purpose: "signup",
          customerId: created.id,
          ip: input.request?.ip,
        });
        outbox.code = { channel: kind === "phone" ? "sms" : "email", to: normalized, code, shopName: input.shopName };
        return {
          ok: true,
          next: "code",
          channel: kind === "phone" ? "sms" : "email",
          identifier: normalized,
          sentTo: maskFor(kind, normalized),
          expiresInMinutes: CODE_MINUTES,
        };
      }

      const session = await createSession(db, created.id, input.request);
      const cartToken = await attachCartToCustomer(db, created.id, input.cartToken ?? null);
      return {
        ok: true,
        next: "signed_in",
        customerId: created.id,
        sessionId: session.sessionId,
        token: session.token,
        cartToken,
      };
    },
  );

  await flush(outbox, input.shopName);
  return result;
}

/**
 * Send a code, whether or not there is an account.
 *
 * Always reports success for a real identifier at a store that takes it. Whether
 * the code signs somebody in, signs them up or claims a guest row is decided by
 * verifyCode, which is the only way to keep those three indistinguishable.
 */
export async function sendCode(input: {
  tenantId: string;
  shopName: string;
  identifier: string;
  request?: AuthRequest;
}): Promise<CodeSent | AuthFailure> {
  const outbox: Outbox = {};
  const result = await withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<CodeSent | AuthFailure> => {
      const policy = await readPolicy(db);
      if (!codesAllowed(policy)) {
        return {
          ok: false,
          field: "identifier",
          message: "This shop signs people in with a password.",
        };
      }

      const checked = checkIdentifier(policy, input.identifier);
      if (!checked.ok) return { ok: false, field: "identifier", message: checked.message };
      const { kind, normalized } = checked;

      const send = await reserveSend(db, kind, normalized);
      if (!send.ok) return send;

      const existing = await findByIdentifier(db, kind, normalized);
      const code = await issueCode(db, {
        identifier: normalized,
        kind,
        // "login" either way: a code for a row that exists and a code for one
        // that does not must be the same event, or the ledger itself is an oracle.
        purpose: "login",
        customerId: existing?.id ?? null,
        ip: input.request?.ip,
      });

      outbox.code = { channel: kind === "phone" ? "sms" : "email", to: normalized, code, shopName: input.shopName };
      return {
        ok: true,
        next: "code",
        channel: kind === "phone" ? "sms" : "email",
        identifier: normalized,
        sentTo: maskFor(kind, normalized),
        expiresInMinutes: CODE_MINUTES,
      };
    },
  );

  await flush(outbox, input.shopName);
  return result;
}

/**
 * Check a code and sign them in.
 *
 * The newest live code for the identifier is taken FOR UPDATE: the row lock is
 * what makes the three-attempt count correct when two guesses arrive together,
 * and without it a burst gets three tries each.
 *
 * "Wrong code" and "this code is burned" say exactly the same thing, so counting
 * attempts from outside tells an attacker nothing about how many are left.
 */
export async function verifyCode(input: {
  tenantId: string;
  identifier: string;
  code: string;
  /** Collected on the same screen; applied only once the code checks out. */
  name?: string;
  password?: string;
  acceptsMarketing?: boolean;
  request?: AuthRequest;
  cartToken?: string | null;
}): Promise<SignedIn | AuthFailure> {
  return withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<SignedIn | AuthFailure> => {
      const policy = await readPolicy(db);
      const checked = checkIdentifier(policy, input.identifier);
      if (!checked.ok) return { ok: false, field: "identifier", message: checked.message };
      const { kind, normalized } = checked;

      const limit = await take(db, "code_verify", normalized);
      if (!limit.ok) {
        return {
          ok: false,
          field: "code",
          message: limit.message,
          retryAfterSeconds: limit.retryAfterSeconds,
        };
      }

      const [pending] = await db
        .select(customerVerifications)
        .where(
          and(
            eq(customerVerifications.identifier, normalized),
            isNull(customerVerifications.consumedAt),
          ),
        )
        .orderBy(desc(customerVerifications.createdAt))
        .limit(1)
        .for("update");

      const expired = !pending || pending.expiresAt.getTime() <= Date.now();
      if (expired) {
        return { ok: false, field: "code", message: "That code has expired. Ask for a new one." };
      }

      if (!codesMatch(pending.codeHash, input.code.trim())) {
        const attempts = pending.attempts + 1;
        await db.update(
          customerVerifications,
          {
            attempts,
            // Burned, not deleted: the ledger still counts it as a send.
            consumedAt: attempts >= MAX_ATTEMPTS ? new Date() : null,
          },
          eq(customerVerifications.id, pending.id),
        );
        // Identical for a wrong code and a burned one, deliberately.
        return { ok: false, field: "code", message: "That code isn't right. Ask for a new one." };
      }

      await db.update(
        customerVerifications,
        { consumedAt: new Date() },
        eq(customerVerifications.id, pending.id),
      );

      const existing = await findByIdentifier(db, kind, normalized);
      const proven = kind === "email" ? { emailVerified: true } : { phoneVerified: true };

      let customerId: string;
      if (existing) {
        /*
         * Signing in, or completing a claim. The code has now proved this
         * identifier belongs to whoever is holding it, which is exactly the
         * permission that showing them these orders requires.
         *
         * No order row is touched: the guest orders already point at this
         * customer, so proving the identifier IS proving the right to them.
         */
        customerId = existing.id;
        await db.update(
          customers,
          {
            ...proven,
            // A password only where they chose one and the row had none; this
            // never overwrites an existing password from a code flow.
            ...(input.password && !existing.passwordHash
              ? { passwordHash: await hashPassword(input.password) }
              : {}),
            ...(input.name?.trim() && !existing.name ? { name: input.name.trim() } : {}),
          },
          eq(customers.id, existing.id),
        );
      } else {
        const [created] = await db.insert(customers, {
          email: kind === "email" ? normalized : null,
          phone: kind === "phone" ? normalized : null,
          name: input.name?.trim() || null,
          passwordHash: input.password ? await hashPassword(input.password) : null,
          acceptsMarketing: input.acceptsMarketing ?? false,
          ...proven,
        });
        if (!created) {
          return { ok: false, message: "We couldn't create that account. Please try again." };
        }
        customerId = created.id;
      }

      await clear(db, "code_verify", normalized);
      await clear(db, "password_attempt", normalized);
      const session = await createSession(db, customerId, input.request);
      const cartToken = await attachCartToCustomer(db, customerId, input.cartToken ?? null);
      return {
        ok: true,
        next: "signed_in",
        customerId,
        sessionId: session.sessionId,
        token: session.token,
        cartToken,
      };
    },
  );
}

/**
 * Prove a second identifier for somebody already signed in.
 *
 * What the "before checkout" gate asks for, and what adding a mobile number to
 * an email account needs. Scoped to the signed-in customer, so it cannot be used
 * to verify an identifier onto somebody else's row.
 */
export async function verifyOwnIdentifier(input: {
  tenantId: string;
  customerId: string;
  identifier: string;
  code: string;
}): Promise<{ ok: true } | AuthFailure> {
  return withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<{ ok: true } | AuthFailure> => {
      const policy = await readPolicy(db);
      const checked = checkIdentifier(policy, input.identifier);
      if (!checked.ok) return { ok: false, field: "identifier", message: checked.message };
      const { kind, normalized } = checked;

      const limit = await take(db, "code_verify", normalized);
      if (!limit.ok) {
        return { ok: false, field: "code", message: limit.message, retryAfterSeconds: limit.retryAfterSeconds };
      }

      const [pending] = await db
        .select(customerVerifications)
        .where(
          and(
            eq(customerVerifications.identifier, normalized),
            isNull(customerVerifications.consumedAt),
          ),
        )
        .orderBy(desc(customerVerifications.createdAt))
        .limit(1)
        .for("update");

      if (!pending || pending.expiresAt.getTime() <= Date.now()) {
        return { ok: false, field: "code", message: "That code has expired. Ask for a new one." };
      }
      if (!codesMatch(pending.codeHash, input.code.trim())) {
        const attempts = pending.attempts + 1;
        await db.update(
          customerVerifications,
          { attempts, consumedAt: attempts >= MAX_ATTEMPTS ? new Date() : null },
          eq(customerVerifications.id, pending.id),
        );
        return { ok: false, field: "code", message: "That code isn't right. Ask for a new one." };
      }

      /*
       * The identifier must be free, or already theirs. Without this check a
       * signed-in customer could verify a mobile number that belongs to another
       * customer of the same shop onto their own account.
       */
      const owner = await findByIdentifier(db, kind, normalized);
      if (owner && owner.id !== input.customerId) {
        return {
          ok: false,
          field: "identifier",
          message: "That contact detail is already used by another account here.",
        };
      }

      await db.update(
        customerVerifications,
        { consumedAt: new Date() },
        eq(customerVerifications.id, pending.id),
      );
      await db.update(
        customers,
        kind === "email"
          ? { email: normalized, emailVerified: true }
          : { phone: normalized, phoneVerified: true },
        eq(customers.id, input.customerId),
      );
      return { ok: true };
    },
  );
}

/**
 * Ask for a password reset.
 *
 * Reports success for an identifier with no account and sends nothing, because
 * the alternative is a form that tells anybody who types an address whether it
 * shops here.
 */
export async function requestPasswordReset(input: {
  tenantId: string;
  shopName: string;
  identifier: string;
  request?: AuthRequest;
}): Promise<CodeSent | AuthFailure> {
  const outbox: Outbox = {};
  const result = await withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<CodeSent | AuthFailure> => {
      const policy = await readPolicy(db);
      const checked = checkIdentifier(policy, input.identifier);
      if (!checked.ok) return { ok: false, field: "identifier", message: checked.message };
      const { kind, normalized } = checked;

      const send = await reserveSend(db, kind, normalized);
      if (!send.ok) return send;

      const existing = await findByIdentifier(db, kind, normalized);
      if (existing) {
        const code = await issueCode(db, {
          identifier: normalized,
          kind,
          purpose: "password_reset",
          customerId: existing.id,
          ip: input.request?.ip,
        });
        outbox.code = { channel: kind === "phone" ? "sms" : "email", to: normalized, code, shopName: input.shopName };
      }

      // The same answer either way.
      return {
        ok: true,
        next: "code",
        channel: kind === "phone" ? "sms" : "email",
        identifier: normalized,
        sentTo: maskFor(kind, normalized),
        expiresInMinutes: CODE_MINUTES,
      };
    },
  );

  await flush(outbox, input.shopName);
  return result;
}

/**
 * Set a new password from a reset code.
 *
 * Every other session goes. A reset is what somebody does when they believe
 * another person has their password, and leaving that person signed in would
 * make the whole exercise theatre.
 */
export async function resetPassword(input: {
  tenantId: string;
  identifier: string;
  code: string;
  password: string;
  request?: AuthRequest;
  cartToken?: string | null;
}): Promise<SignedIn | AuthFailure> {
  if (input.password.length < 10) {
    return { ok: false, field: "password", message: "Use at least 10 characters." };
  }

  const verified = await verifyCode({
    tenantId: input.tenantId,
    identifier: input.identifier,
    code: input.code,
    request: input.request,
    cartToken: input.cartToken,
  });
  if (!verified.ok) return verified;

  return withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<SignedIn> => {
      await db.update(
        customers,
        { passwordHash: await hashPassword(input.password) },
        eq(customers.id, verified.customerId),
      );
      /*
       * Every session except the one the code just issued. Signing them out of
       * the device they are holding would be a strange way to finish a reset,
       * and every OTHER session is the point of doing this at all.
       */
      await revokeAllSessions(db, verified.customerId, verified.sessionId);
      return verified;
    },
  );
}

/** Change or set a password from inside the account area. */
export async function setPassword(input: {
  tenantId: string;
  customerId: string;
  sessionId: string;
  current?: string;
  password: string;
}): Promise<{ ok: true } | AuthFailure> {
  if (input.password.length < 10) {
    return { ok: false, field: "password", message: "Use at least 10 characters." };
  }

  return withTenant(
    { tenantId: input.tenantId, actorId: input.tenantId, role: "staff" },
    async (db): Promise<{ ok: true } | AuthFailure> => {
      const [customer] = await db
        .select(customers)
        .where(eq(customers.id, input.customerId))
        .limit(1);
      if (!customer) return { ok: false, message: "Please sign in again." };

      if (customer.passwordHash) {
        const good =
          input.current
            ? await verifyPassword(customer.passwordHash, input.current).catch(() => false)
            : false;
        if (!good) {
          return { ok: false, field: "password", message: "That isn't your current password." };
        }
      }

      await db.update(
        customers,
        { passwordHash: await hashPassword(input.password) },
        eq(customers.id, input.customerId),
      );

      // Other devices are signed out, because a password change is usually a
      // reaction to something. The one doing the changing stays.
      await revokeAllSessions(db, input.customerId, input.sessionId);
      return { ok: true };
    },
  );
}

export type { CustomerPolicy };
