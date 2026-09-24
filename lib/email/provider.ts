import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/*
 * Email behind one interface, with a console implementation when SMTP is not
 * configured.
 *
 * That fallback is not laziness — it means a fresh clone can run the entire
 * signup and verification flow offline, with the six-digit code printed to the
 * terminal. A contributor should never be blocked on someone else's mail
 * credentials to test a login.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: "smtp" | "console";
  send(message: EmailMessage): Promise<void>;
}

let transporter: Transporter | undefined;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

const consoleProvider: EmailProvider = {
  name: "console",
  async send(message) {
    const rule = "─".repeat(64);
    // Deliberately loud. A developer scanning the terminal for a login code
    // should not have to hunt for it among request logs.
    console.log(
      `\n${rule}\n  EMAIL (not sent — SMTP is not configured)\n  To:      ${message.to}\n  Subject: ${message.subject}\n${rule}\n${message.text}\n${rule}\n`,
    );
  },
};

const smtpProvider: EmailProvider = {
  name: "smtp",
  async send(message) {
    transporter ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
    });

    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? "BuilderHut <hello@builderhut.local>",
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  },
};

export function getEmailProvider(): EmailProvider {
  return smtpConfigured() ? smtpProvider : consoleProvider;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const provider = getEmailProvider();
  try {
    await provider.send(message);
    /*
     * Logged on success, not only on failure.
     *
     * "Did it send?" was unanswerable from the logs the first time a code did
     * not arrive: a successful SMTP handoff and a silent misconfiguration
     * looked identical.
     *
     * The recipient is enough to tell those apart. The subject is NOT logged,
     * and that is not squeamishness — the verification subject line is
     * "123456 is your BuilderHut verification code", so logging it put live
     * one-time codes into the platform's log stream, readable by anyone with
     * deployment access. It did, for about ten minutes, until this was written.
     */
    if (provider.name === "smtp") console.log(`[email] sent via smtp to ${message.to}`);
  } catch (error) {
    // Never let a mail outage take down signup. The caller decides what to tell
    // the user; what must not happen is an unhandled rejection in a route.
    console.error(`[email] ${provider.name} send failed for ${message.to}:`, error);
    throw error;
  }
}
