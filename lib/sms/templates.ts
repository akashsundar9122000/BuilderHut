import "server-only";

import type { SmsMessage } from "./provider";

/*
 * One message, kept short.
 *
 * An SMS is 160 characters before it becomes two and costs twice as much, and
 * the shop's name matters more than ours: the recipient is that shop's customer
 * and may never have heard of BuilderHut. Same reasoning as invitationEmail.
 */

/**
 * The sign-in code.
 *
 * The phrase "verification code is" is load-bearing: e2e/support/journey.ts
 * greps the console provider's output for it, exactly as it does for
 * verificationCodeEmail. Reword it and the end-to-end suite times out twenty
 * seconds later with a failure that reads like a product bug.
 */
export function verificationCodeSms(
  to: string,
  code: string,
  minutes: number,
  shopName: string,
): SmsMessage {
  return {
    to,
    text: `Your ${shopName} verification code is ${code}. It expires in ${minutes} minutes. Don't share it with anyone.`,
    variables: { code, shop: shopName },
  };
}
