import "server-only";

/*
 * Text messages behind one interface, with a console implementation when no
 * provider is configured.
 *
 * Structurally this is lib/email/provider.ts, for the same reason: a fresh clone
 * must be able to run the whole mobile sign-in flow offline, with the code
 * printed to the terminal, and nobody should need somebody else's SMS
 * credentials — or spend their money — to test a login.
 *
 * Both adapters talk plain fetch. lib/payments/razorpay.ts speaks to a payment
 * gateway the same way and adds nothing to the lockfile; an SMS API is a POST.
 */

export interface SmsMessage {
  /** E.164, as lib/customers/phone.ts produces. */
  to: string;
  /**
   * The whole message, containing the code.
   *
   * NEVER logged, never put in an error, never echoed. See sendSms below.
   */
  text: string;
  /**
   * MSG91 template id. India's DLT rules require registered template text with
   * the code as a variable rather than arbitrary content, so `text` is what the
   * console provider prints and what Twilio sends, and these are what MSG91 gets.
   */
  templateId?: string;
  variables?: Record<string, string>;
}

export interface SmsProvider {
  readonly name: "msg91" | "twilio" | "console";
  send(message: SmsMessage): Promise<void>;
}

function msg91Configured(): boolean {
  return Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);
}

function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM,
  );
}

export function smsConfigured(): boolean {
  const explicit = process.env.SMS_PROVIDER;
  if (explicit === "console") return false;
  if (explicit === "msg91") return msg91Configured();
  if (explicit === "twilio") return twilioConfigured();
  return msg91Configured() || twilioConfigured();
}

const consoleProvider: SmsProvider = {
  name: "console",
  async send(message) {
    const rule = "─".repeat(64);
    /*
     * Deliberately loud, and in the same shape the email provider prints, so
     * e2e/support/journey.ts can read a code out of either with one helper.
     * The phrase "verification code is" in lib/sms/templates.ts is what that
     * helper greps for — see the note there before rewording anything.
     */
    console.log(
      `\n${rule}\n  SMS (not sent — no SMS provider is configured)\n  To:      ${message.to}\n${rule}\n${message.text}\n${rule}\n`,
    );
  },
};

const msg91Provider: SmsProvider = {
  name: "msg91",
  async send(message) {
    const response = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: {
        authkey: process.env.MSG91_AUTH_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: message.templateId ?? process.env.MSG91_OTP_TEMPLATE_ID,
        short_url: 0,
        recipients: [
          {
            // MSG91 wants digits without the leading plus.
            mobiles: message.to.replace(/^\+/, ""),
            ...(message.variables ?? {}),
          },
        ],
      }),
    });
    if (!response.ok) {
      /*
       * The status, and nothing else.
       *
       * MSG91's error body echoes the request back, variables included — so
       * `console.error(await response.text())` would put live one-time codes in
       * the log stream. That is precisely the mistake commit 1c8ce77 fixed for
       * the email subject line, and it is available here in a nastier form.
       */
      throw new Error(`msg91 refused the message (HTTP ${response.status})`);
    }
  },
};

const twilioProvider: SmsProvider = {
  name: "twilio",
  async send(message) {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const from = process.env.TWILIO_FROM!;
    const body = new URLSearchParams({ To: message.to, Body: message.text });
    // A Messaging Service SID starts MG; a plain number goes in From.
    if (from.startsWith("MG")) body.set("MessagingServiceSid", from);
    else body.set("From", from);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    // Status only, for the reason given above: the response repeats Body.
    if (!response.ok) throw new Error(`twilio refused the message (HTTP ${response.status})`);
  },
};

export function getSmsProvider(): SmsProvider {
  const explicit = process.env.SMS_PROVIDER;
  if (explicit === "console") return consoleProvider;
  if (explicit === "msg91") return msg91Configured() ? msg91Provider : consoleProvider;
  if (explicit === "twilio") return twilioConfigured() ? twilioProvider : consoleProvider;
  if (msg91Configured()) return msg91Provider;
  if (twilioConfigured()) return twilioProvider;
  return consoleProvider;
}

export async function sendSms(message: SmsMessage): Promise<void> {
  const provider = getSmsProvider();
  try {
    await provider.send(message);
    /*
     * The recipient, and only the recipient.
     *
     * Not message.text, not message.variables, not the provider's response.
     * Every one of those contains the code, and a log line that contains a live
     * code is readable by everyone with deployment access. The email provider
     * learned this the expensive way; this file starts there.
     */
    if (provider.name !== "console") {
      console.log(`[sms] sent via ${provider.name} to ${message.to}`);
    }
  } catch (error) {
    // Never let an SMS outage take down sign-in. The caller decides what the
    // customer is told; what must not happen is an unhandled rejection.
    console.error(
      `[sms] ${provider.name} send failed for ${message.to}:`,
      error instanceof Error ? error.message : "unknown error",
    );
    throw error;
  }
}
