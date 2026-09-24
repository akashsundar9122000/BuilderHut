import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runUnpaidOrderReminders } from "@/lib/marketing/reminders";
import { recordIncident } from "@/lib/platform/incidents";

/*
 * One nudge, once a day, about orders that were never paid for.
 *
 * Same shared-secret gate as the rollup: without one this is an endpoint
 * anyone can use to make the platform send email, which is both a bill and a
 * reputation. A missing secret closes it in production rather than opening it.
 *
 * Retrying is safe by construction — an order is marked reminded before the
 * send, in an update conditioned on it not already being marked.
 */

export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runUnpaidOrderReminders()) });
  } catch (error) {
    console.error("[cron/reminders] failed:", error);
    await recordIncident({
      kind: "cron.reminders_failed",
      severity: "error",
      summary: "The unpaid-order reminder run did not complete",
      detail: { error },
    });
    return NextResponse.json({ ok: false, error: "Reminders failed" }, { status: 500 });
  }
}
