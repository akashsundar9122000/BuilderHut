import "server-only";
import type { EmailMessage } from "./provider";
import { formatMoney } from "@/lib/money";

/*
 * Table-based HTML, inline styles, no external CSS.
 *
 * Email clients are a decade behind browsers: Outlook renders through Word, and
 * Gmail strips <style> blocks. This looks like 2005 markup on purpose — it is
 * the only thing that renders consistently.
 *
 * Colours are literal hex here rather than design tokens, because an email has
 * no stylesheet to read them from. This file is the single exception to the
 * "no raw hex" rule, and the values track styles/tokens.css by hand.
 */

const CANVAS = "#fbf8f3";
const INK = "#1c1917";
const MUTED = "#6b625a";
const CLAY = "#a84c32";
const BORDER = "#e7dfd3";

function shell(heading: string, body: string, footer?: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;">
        <tr><td style="padding:32px 32px 0;">
          <div style="font:600 12px/1 -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:${CLAY};">BuilderHut</div>
          <h1 style="margin:16px 0 0;font:400 26px/1.2 Georgia,'Times New Roman',serif;color:${INK};">${heading}</h1>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:${INK};">
          ${body}
        </td></tr>
      </table>
      <div style="max-width:480px;margin:16px auto 0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:${MUTED};text-align:center;">
        ${footer ?? "You received this because someone used this address to sign up for BuilderHut."}
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export function verificationCodeEmail(to: string, code: string, minutes: number): EmailMessage {
  const spaced = code.split("").join("&nbsp;&nbsp;");
  return {
    to,
    subject: `${code} is your BuilderHut verification code`,
    html: shell(
      "Confirm your email",
      `<p style="margin:0 0 20px;">Enter this code to finish setting up your store.</p>
       <div style="font:600 30px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:${INK};background:${CANVAS};border:1px solid ${BORDER};border-radius:8px;padding:18px;text-align:center;">${spaced}</div>
       <p style="margin:20px 0 0;color:${MUTED};font-size:13px;">The code expires in ${minutes} minutes. If you didn't ask for it, you can ignore this email — nothing has been created.</p>`,
    ),
    text: `Confirm your email\n\nYour BuilderHut verification code is ${code}\n\nIt expires in ${minutes} minutes. If you didn't request it, ignore this email — nothing has been created.`,
  };
}

export function passwordResetEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Reset your BuilderHut password",
    html: shell(
      "Reset your password",
      `<p style="margin:0 0 20px;">Use the button below to choose a new password.</p>
       <a href="${url}" style="display:inline-block;background:${CLAY};color:#ffffff;text-decoration:none;font:500 15px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 22px;border-radius:8px;">Choose a new password</a>
       <p style="margin:20px 0 0;color:${MUTED};font-size:13px;">This link expires in an hour. If you didn't ask to reset your password, nothing has changed and you can ignore this.</p>`,
    ),
    text: `Reset your BuilderHut password\n\n${url}\n\nThis link expires in an hour. If you didn't request it, nothing has changed.`,
  };
}

/**
 * An invitation to help run somebody's shop.
 *
 * The shop's name is in the subject, because the recipient probably does not
 * know what BuilderHut is — they know they were expecting an email from the
 * person whose shop it is.
 */
export function invitationEmail(to: string, shopName: string, url: string): EmailMessage {
  return {
    to,
    subject: `You've been invited to help run ${shopName}`,
    html: shell(
      `Help run ${shopName}`,
      `<p style="margin:0 0 20px;">You've been invited to help run <strong>${shopName}</strong> on BuilderHut. Accepting gives you access to its dashboard.</p>
       <a href="${url}" style="display:inline-block;background:${CLAY};color:#ffffff;text-decoration:none;font:500 15px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 22px;border-radius:8px;">Accept the invitation</a>
       <p style="margin:20px 0 0;color:${MUTED};font-size:13px;">This link expires in three days and works once, for this address only. If you weren't expecting it, you can ignore this email — nothing has been created.</p>`,
    ),
    text: `Help run ${shopName}\n\nYou've been invited to help run ${shopName} on BuilderHut.\n\n${url}\n\nThis link expires in three days and works once, for this address only. If you weren't expecting it, ignore this email — nothing has been created.`,
  };
}

/**
 * A nudge about an order somebody never paid for.
 *
 * One of these is ever sent. It leads with what they were buying and links
 * straight to the order, because the likeliest reason it went unpaid is a card
 * that did not go through — and the useful thing is a way to try again, not a
 * discount code or a countdown.
 */
export function unpaidOrderEmail(
  to: string,
  order: {
    shopName: string;
    orderNumber: number;
    totalMinor: number;
    currency: string;
    url: string;
  },
): EmailMessage {
  const total = formatMoney(order.totalMinor, order.currency);
  return {
    to,
    subject: `Your ${order.shopName} order is still waiting`,
    html: shell(
      "Your order is still waiting",
      `<p style="margin:0 0 20px;">Order #${order.orderNumber} at <strong>${order.shopName}</strong> hasn't been paid for yet — usually that means a card didn't go through rather than a change of heart.</p>
       <p style="margin:0 0 20px;color:${MUTED};font-size:14px;">Total: ${total}</p>
       <a href="${order.url}" style="display:inline-block;background:${CLAY};color:#ffffff;text-decoration:none;font:500 15px/1 -apple-system,Segoe UI,Roboto,sans-serif;padding:14px 22px;border-radius:8px;">Finish paying</a>
       <p style="margin:20px 0 0;color:${MUTED};font-size:13px;">If you've changed your mind, you can ignore this — nothing has been charged and we won't email you about it again.</p>`,
    ),
    text: `Your order is still waiting\n\nOrder #${order.orderNumber} at ${order.shopName} hasn't been paid for yet. Total: ${total}\n\n${order.url}\n\nIf you've changed your mind, ignore this — nothing has been charged and we won't email you about it again.`,
  };
}
