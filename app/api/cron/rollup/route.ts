import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runRollup } from "@/lib/analytics/rollup";

/*
 * Nightly analytics rollup.
 *
 * Folds yesterday's and today's raw events into one row per store per day, then
 * purges raw events past their retention window. Recomputes rather than
 * increments, so a retried cron run is harmless — which matters, because a cron
 * that retries is a cron that will eventually run twice.
 *
 * Protected by a shared secret. Without one this is an unauthenticated endpoint
 * that anyone can hammer into doing the platform's heaviest query repeatedly.
 */

export const maxDuration = 300;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // In development there is no secret and no harm; in production a missing
  // secret means the endpoint is closed rather than open.
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // Length-checked first: timingSafeEqual throws on a mismatch, and === would
  // leak the secret a byte at a time.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  try {
    const summary = await runRollup();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron/rollup] failed:", error);
    return NextResponse.json({ ok: false, error: "Rollup failed" }, { status: 500 });
  }
}
