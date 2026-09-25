import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { PlanSwitcher } from "@/components/dashboard/PlanSwitcher";
import { Card, CardBody } from "@/components/ui";
import { requireActor, runForTenant } from "@/lib/auth/session";
import { formatMoney } from "@/lib/money";
import { ORDERED_PLANS } from "@/lib/plans/catalog";
import { limitStates } from "@/lib/plans/entitlements";

export const metadata: Metadata = { title: "Plan" };

/*
 * What this shop is on, and what it is using.
 *
 * Usage first, plans second. A merchant opening this screen is almost always
 * answering "why can't I add another product" — so the meters are the answer,
 * and the ladder underneath is what to do about it.
 */
export default async function PlanPage() {
  await requireActor();
  // Inside the tenant scope: the meters count rows that RLS only shows when a
  // tenant context is set, and outside one they all read zero.
  const { plan, usage, meters } = await runForTenant((db) => limitStates(db));

  const rows: {
    label: string;
    state: (typeof meters)[keyof typeof meters];
    unit: string;
    usedLabel?: string;
    limitLabel?: string | null;
  }[] = [
    { label: "Products", state: meters.products, unit: "" },
    { label: "People on the shop", state: meters.staff, unit: "" },
    { label: "Your own domains", state: meters.customDomains, unit: "" },
    {
      label: "Pictures",
      state: meters.storageMb,
      unit: " MB",
      // Shown from the real byte count, so two small uploads read as
      // "0.2 MB of 250 MB" rather than as nothing having happened.
      usedLabel: formatBytes(usage.storageBytes),
      // 5000 MB is a number; 5 GB is a size.
      limitLabel:
        meters.storageMb.limit === null ? null : formatBytes(meters.storageMb.limit * 1_000_000),
    },
  ];

  return (
    <div className="mx-auto max-w-(--bh-dash-w)">
      <header className="mb-7">
        <h1 className="font-display text-3xl leading-tight">Plan</h1>
        <p className="text-muted mt-1.5 text-sm">
          You&rsquo;re on {plan.name}. Nothing is being charged yet — you can move between
          these at no cost while BuilderHut is early.
        </p>
      </header>

      <Card className="mb-6">
        <CardBody className="flex flex-col gap-5">
          <p className="text-faint text-[0.65rem] font-medium tracking-[0.14em] uppercase">
            What you&rsquo;re using
          </p>
          {rows.map(({ label, state, unit, usedLabel, limitLabel }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-text-secondary">{label}</span>
                <span className={state.atLimit ? "text-warning font-medium" : "text-muted"}>
                  {state.limit === 0
                    ? /* A ceiling of zero is not "0 of 0" — it is a thing this
                         plan does not include at all. */
                      "Not on this plan"
                    : state.limit === null
                      ? `${usedLabel ?? `${state.used}${unit}`} · no limit`
                      : `${usedLabel ?? `${state.used}${unit}`} of ${limitLabel ?? `${state.limit}${unit}`}`}
                </span>
              </div>
              {state.limit === null || state.limit === 0 ? null : (
                <div className="bg-sunken h-1.5 overflow-hidden rounded-full">
                  <div
                    className={state.atLimit ? "bg-warning h-full" : "bg-accent h-full"}
                    style={{
                      width: `${Math.min(100, Math.round((state.used / Math.max(1, state.limit)) * 100))}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {ORDERED_PLANS.map((option) => (
          <Card key={option.id} className={option.id === plan.id ? "border-accent" : undefined}>
            <CardBody className="flex h-full flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-lg">{option.name}</p>
                  {option.id === plan.id ? (
                    <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
                      Current
                    </span>
                  ) : null}
                </div>
                <p className="font-display mt-1 text-2xl">
                  {option.priceMinor === 0
                    ? "Free"
                    : formatMoney(option.priceMinor, option.currency)}
                  {option.priceMinor > 0 ? (
                    <span className="text-muted font-sans text-xs"> /month</span>
                  ) : null}
                </p>
              </div>

              <p className="text-muted text-xs leading-relaxed">{option.headline}</p>

              <ul className="flex flex-1 flex-col gap-1.5 text-xs">
                <Line on>{option.limits.products === null ? "Products: no limit" : `${option.limits.products} products`}</Line>
                <Line on>
                  {option.limits.customDomains === 0
                    ? "BuilderHut address only"
                    : option.limits.customDomains === 1
                      ? "Your own domain"
                      : `${option.limits.customDomains} of your own domains`}
                </Line>
                <Line on>
                  {option.limits.staff === null
                    ? "People: no limit"
                    : option.limits.staff === 1
                      ? "Just you"
                      : `${option.limits.staff} people`}
                </Line>
                <Line on={option.features.removeBranding}>No BuilderHut footer line</Line>
                <Line on={option.features.discountCodes}>Discount codes</Line>
                <Line on={option.features.marketingTools}>Marketing tools</Line>
              </ul>

              <PlanSwitcher planId={option.id} planName={option.name} current={option.id === plan.id} />
            </CardBody>
          </Card>
        ))}
      </div>

      <p className="text-faint mt-6 text-xs">
        Moving down is refused while you&rsquo;re over the smaller plan&rsquo;s limits, so
        nothing you&rsquo;ve already made is switched off behind your back.{" "}
        <Link href="/app/products" className="hover:text-text underline">
          Your products
        </Link>
        .
      </p>
    </div>
  );
}

function Line({ on = false, children }: { on?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {on ? (
        <Check className="text-success mt-0.5 size-3.5 shrink-0" aria-label="Included" />
      ) : (
        <Minus className="text-faint mt-0.5 size-3.5 shrink-0" aria-label="Not included" />
      )}
      <span className={on ? "text-text-secondary" : "text-faint"}>{children}</span>
    </li>
  );
}

/** Bytes as a merchant would say them. */
function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  const mb = bytes / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
