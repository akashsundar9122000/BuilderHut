/*
 * Mobile numbers, normalised to one shape.
 *
 * "+91 98765 43210", "098765 43210" and "9876543210" are one person. Stored as
 * they were typed they are three accounts, and the third one to place an order
 * gets a stranger's order history — so the column holds E.164 and nothing else,
 * every write goes through here, and a CHECK constraint in the database refuses
 * anything that did not.
 *
 * No libphonenumber-js. It is 140KB to validate numbers for 240 countries when
 * onboarding offers six, and the day a seventh needs real national-format rules
 * is the day to swap this one file for it.
 */

/** The countries onboarding offers, plus Canada, which shares +1 with the US. */
export const DIAL_CODES: Readonly<Record<string, string>> = {
  IN: "+91",
  GB: "+44",
  US: "+1",
  CA: "+1",
  AE: "+971",
  SG: "+65",
  AU: "+61",
};

/** E.164: a plus, a non-zero country digit, then 7 to 14 more. */
const E164 = /^\+[1-9][0-9]{7,14}$/;

export type PhoneResult = { ok: true; e164: string } | { ok: false; message: string };

/**
 * Normalise a typed number to E.164.
 *
 * A typed "+" is authoritative — somebody who writes their country code means
 * it, wherever the shop happens to be. Without one, the store's own country
 * supplies the dial code, and a single leading trunk zero is dropped: "098765"
 * in India is "+9198765", not "+91098765".
 */
export function normalizePhone(raw: string, defaultCountry: string): PhoneResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, message: "Enter a mobile number." };

  // Everything a person might type between digits: spaces, dashes, brackets,
  // dots. A "+" survives only where it belongs, at the front.
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  const plus = cleaned.startsWith("+");
  const digits = cleaned.replace(/\+/g, "");

  if (digits.length === 0) return { ok: false, message: "Enter a mobile number." };

  let candidate: string;
  if (plus) {
    candidate = `+${digits}`;
  } else {
    const dial = DIAL_CODES[defaultCountry.toUpperCase()];
    if (!dial) {
      return {
        ok: false,
        message: "Include your country code, like +44 7911 123456.",
      };
    }
    candidate = `${dial}${digits.replace(/^0+/, "")}`;
  }

  if (!E164.test(candidate)) {
    return {
      ok: false,
      message: "That doesn't look like a mobile number. Check the digits and try again.",
    };
  }
  return { ok: true, e164: candidate };
}

/** True for a value already in the stored shape. What the CHECK constraint enforces. */
export function isE164(value: string): boolean {
  return E164.test(value);
}

/**
 * "+91 •••••3210" — for "we sent a code to …".
 *
 * Shows the country code and the last four digits and hides the rest: enough for
 * the owner to recognise their own number, not enough for somebody else to learn
 * one they were guessing at.
 */
export function maskPhone(e164: string): string {
  if (!E164.test(e164)) return "your mobile";
  const tail = e164.slice(-4);
  const dial = Object.values(DIAL_CODES)
    .filter((code) => e164.startsWith(code))
    // Longest match wins: +971 before +9.
    .sort((a, b) => b.length - a.length)[0];
  const head = dial ?? e164.slice(0, 3);
  const hidden = "•".repeat(Math.max(2, e164.length - head.length - 4));
  return `${head} ${hidden}${tail}`;
}

/** "a•••@example.com". The domain stays, because it is how you recognise it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "your email";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, local.length - 1))}${domain}`;
}
