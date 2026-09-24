import type { Metadata } from "next";
import Link from "next/link";
import { MailWarning } from "lucide-react";

import { RemindersToggle } from "@/components/dashboard/RemindersToggle";
import { Card, CardBody } from "@/components/ui";
import { requireActor, runForTenant } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

import { getRootDb } from "@/lib/db/client";
import { storeSettings, tenants } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { cheapestPlanWith } from "@/lib/plans/catalog";
import { planFor } from "@/lib/plans/entitlements";
import { recoveryStats } from "@/lib/marketing/reminders";

export const metadata: Metadata = { title: "Marketing" };

/*
 * One tool, working, rather than a page of things that are coming.
 *
 * Reminding somebody about an order they never paid for is the highest-value
 * thing a small shop can automate: those are customers who meant to buy and
 * hit a declined card. Campaign sends and subscriber lists can wait until this
 * one has earned its place.
 */
export default async function MarketingPage() {
  const actor = await requireActor();
  const [plan, stats, settings, currency] = await Promise.all([
    planFor(actor.tenantId!),
    recoveryStats(actor.tenantId!),
    runForTenant(async (db) => (await db.select(storeSettings).limit(1))[0] ?? null),
    currencyFor(actor.tenantId!),
  ]);

  const included = plan.features.marketingTools;
  const needed = cheapestPlanWith("marketingTools");

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Marketing</h1>
        <p className="text-muted mt-1.5 text-sm">
          Getting back the sales that nearly happened.
        </p>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <MailWarning className="text-accent mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-text text-sm font-medium">Unpaid order reminders</p>
              <p className="text-muted mt-1 text-sm leading-relaxed">
                When somebody places an order and the payment doesn&rsquo;t go through, they get
                one email a few hours later with a link back to it. One, not a sequence — a
                second email doesn&rsquo;t recover twice as many, it just makes your shop a
                nuisance.
              </p>
            </div>
          </div>

          {included ? (
            <RemindersToggle enabled={settings?.remindUnpaidOrders ?? true} />
          ) : (
            <p className="text-warning bg-warning-soft rounded-md px-3 py-2.5 text-sm leading-relaxed">
              This is part of {needed?.name ?? "a larger plan"}. You&rsquo;re on {plan.name} —{" "}
              <Link href="/app/plan" className="underline">
                see what changes
              </Link>
              .
            </p>
          )}

          <div className="border-border grid grid-cols-3 gap-4 border-t pt-4">
            <Figure label="Waiting to be nudged" value={String(stats.waiting)} />
            <Figure label="Reminded" value={String(stats.reminded)} />
            <Figure
              label="Paid after a reminder"
              value={String(stats.recovered)}
              note={
                stats.recovered > 0
                  ? formatMoney(stats.recoveredMinor, currency)
                  : undefined
              }
            />
          </div>

          <p className="text-faint text-xs leading-relaxed">
            Reminders go out once a day. An order is nudged between four and seventy-two hours
            after it was placed — long enough that a retry plainly didn&rsquo;t happen, and not so
            long that the email is only a reminder of a failure.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/** The shop's own currency. Recovered revenue in the wrong one is a wrong number. */
async function currencyFor(tenantId: string): Promise<string> {
  const rows = await getRootDb()
    .select({ currency: tenants.currency })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return rows[0]?.currency ?? "INR";
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="font-display text-text text-2xl tabular-nums">{value}</p>
      <p className="text-muted mt-0.5 text-xs leading-snug">{label}</p>
      {note ? <p className="text-accent-2 mt-0.5 text-xs tabular-nums">{note}</p> : null}
    </div>
  );
}
