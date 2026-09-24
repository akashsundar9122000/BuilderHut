import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSmsProvider, sendSms, smsConfigured } from "@/lib/sms/provider";
import { verificationCodeSms } from "@/lib/sms/templates";
import { readVerificationCodeFrom } from "@/e2e/support/read-code";

/*
 * The SMS provider, and one rule that matters more than the rest.
 *
 * Commit 1c8ce77 removed an email subject from a log line because the subject was
 * "123456 is your BuilderHut verification code" — live one-time codes in the
 * platform's log stream, readable by anyone with deployment access. An SMS is
 * worse: the code is the whole message, and MSG91's error body echoes the
 * variables back. So "never log the code" is asserted here rather than left as a
 * comment for somebody to helpfully improve away.
 */

const saved = { ...process.env };

function set(vars: Record<string, string | undefined>) {
  for (const key of [
    "SMS_PROVIDER",
    "MSG91_AUTH_KEY",
    "MSG91_OTP_TEMPLATE_ID",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM",
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) process.env[key] = value;
  }
}

const MSG91 = { MSG91_AUTH_KEY: "key", MSG91_OTP_TEMPLATE_ID: "tpl" };
const TWILIO = { TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "token", TWILIO_FROM: "+15550000000" };

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("choosing a provider", () => {
  it("prints to the console when nothing is configured, so a clone works offline", () => {
    set({});
    expect(getSmsProvider().name).toBe("console");
    expect(smsConfigured()).toBe(false);
  });

  it("auto-detects MSG91, then Twilio", () => {
    set(MSG91);
    expect(getSmsProvider().name).toBe("msg91");
    set(TWILIO);
    expect(getSmsProvider().name).toBe("twilio");
    set({ ...MSG91, ...TWILIO });
    expect(getSmsProvider().name).toBe("msg91");
  });

  it("lets SMS_PROVIDER override the detection", () => {
    set({ ...MSG91, ...TWILIO, SMS_PROVIDER: "twilio" });
    expect(getSmsProvider().name).toBe("twilio");
  });

  /*
   * What playwright.config.ts relies on: forcing "console" must beat real
   * credentials sitting in a developer's .env.local, or the e2e suite texts
   * made-up numbers at their expense.
   */
  it("forces the console provider when told to, even with credentials present", () => {
    set({ ...MSG91, ...TWILIO, SMS_PROVIDER: "console" });
    expect(getSmsProvider().name).toBe("console");
    expect(smsConfigured()).toBe(false);
  });

  it("falls back to the console rather than half-using a partial configuration", () => {
    set({ MSG91_AUTH_KEY: "key" });
    expect(getSmsProvider().name).toBe("console");
    set({ SMS_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "AC123" });
    expect(getSmsProvider().name).toBe("console");
  });
});

describe("what reaches the log", () => {
  const message = verificationCodeSms("+919876543210", "483920", 10, "Thread & Bloom");

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function logged(): string {
    const calls = [
      ...(console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls,
      ...(console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls,
    ];
    return calls.flat().map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join("\n");
  }

  it("logs the recipient and not the code, on a successful send", async () => {
    set(MSG91);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
    await sendSms(message);
    expect(logged()).toContain("+919876543210");
    expect(logged()).not.toContain("483920");
  });

  it("logs the status and not the provider's body, on a failed send", async () => {
    set(MSG91);
    // MSG91 echoes the request variables back in its error body. Reading that
    // into a log line is the same mistake as logging the subject, in a worse form.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ recipients: [{ code: "483920" }] }), { status: 400 })),
    );
    await expect(sendSms(message)).rejects.toThrow(/msg91/i);
    expect(logged()).toContain("+919876543210");
    expect(logged()).not.toContain("483920");
  });

  it("never leaks the code through Twilio's response either", async () => {
    set(TWILIO);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ body: message.text }), { status: 401 })));
    await expect(sendSms(message)).rejects.toThrow(/twilio/i);
    expect(logged()).not.toContain("483920");
  });

  /*
   * The console provider is the exception, and has to be: printing the code is
   * the entire point of it, and it only ever runs where no provider is
   * configured — a developer's terminal, and the e2e suite's log.
   */
  it("prints the code when nothing is configured, because that is what it is for", async () => {
    set({});
    await sendSms(message);
    expect(logged()).toContain("483920");
  });
});

describe("the console output the e2e suite reads", () => {
  it("is in a shape readVerificationCode can parse, for a mobile number", async () => {
    set({});
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      lines.push(args.join(" "));
    });
    await sendSms(verificationCodeSms("+919876543210", "483920", 10, "Thread & Bloom"));

    /*
     * Run the real helper's regex against the real output. A copy edit to either
     * then fails here, in a second, rather than timing the e2e suite out twenty
     * seconds later with something that reads like a product bug.
     */
    expect(readVerificationCodeFrom(lines.join("\n"), "+919876543210")).toBe("483920");
  });
});
