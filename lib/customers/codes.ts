import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { appSecret } from "@/lib/auth/app-secret";

/*
 * Six-digit codes.
 *
 * The numbers match the merchant realm (lib/auth/merchant.ts) deliberately: ten
 * minutes to use it, three guesses before it is burned. A customer who has seen
 * one flow should not find the other one behaving differently.
 */

/** Matches OTP_MINUTES in lib/auth/merchant.ts. */
export const CODE_MINUTES = 10;

/** Matches the emailOTP plugin's allowedAttempts. Three guesses at a million. */
export const MAX_ATTEMPTS = 3;

/** How long a code stays readable in the ledger before it is purged. */
export const LEDGER_HOURS = 48;

/** Six digits, zero-padded, from the CSPRNG. Never Math.random. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * HMAC-SHA256 of the code, keyed by the deployment secret.
 *
 * Not a bare SHA-256. There are only a million six-digit codes, so an unkeyed
 * digest of one is a lookup table somebody builds once — which makes a database
 * dump enough to read every code in flight. The key is what makes the stored
 * value useless on its own.
 */
export function hashCode(code: string): string {
  return createHmac("sha256", appSecret()).update(code).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function codesMatch(storedHash: string, candidate: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashCode(candidate), "hex");
  // timingSafeEqual throws on a length mismatch, which would itself leak.
  if (expected.length !== actual.length || expected.length === 0) return false;
  return timingSafeEqual(expected, actual);
}

export function codeExpiry(now = new Date()): Date {
  return new Date(now.getTime() + CODE_MINUTES * 60_000);
}
