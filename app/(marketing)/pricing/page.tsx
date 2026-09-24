import Link from "next/link";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";

import { Faq } from "@/components/marketing/Faq";
import { Reveal } from "@/components/marketing/Reveal";
import { Section, SectionHead, Shell } from "@/components/marketing/Shell";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { ORDERED_PLANS, type Plan } from "@/lib/plans/catalog";

export const metadata: Metadata = {
  title: "Pricing — BuilderHut",
  description:
    "A real shop at a BuilderHut address costs nothing. You only pay when you want your own domain, your own staff, or the BuilderHut line out of your footer.",
};

/*
 * Pricing, on its own route.
 *
 * It used to be an anchor on the landing page — which meant e2e/a11y.spec.ts,
 * which has always listed "/pricing" among the pages it sweeps, was quietly
 * scanning the 404 page and passing. The pricing tables had never been checked
 * by axe at all. Giving it a real route makes that entry do its job, and gives
 * the header a destination that works from /guide and /templates too.
 *
 * Every number and every bullet is derived from lib/plans/catalog. Nothing
 * here restates a limit — a price list that disagrees with what the software
 * enforces is worse than no price list.
 */

export default function PricingPage() {
  return (
    <main>
      <Section className="pt-16 pb-6 sm:pt-24">
        <Shell>
          <SectionHead
            align="center"
            eyebrow="Pricing"
            title={<>Start free. Pay when it&rsquo;s earning.</>}
            sub="A real shop at a BuilderHut address costs nothing, for as long as you like. You only pay when you want your own domain, your own staff, or the BuilderHut line out of your footer."
          />
        </Shell>
      </Section>

      <Section className="pb-24">
        <Shell>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {ORDERED_PLANS.map((plan, index) => (
              <Reveal key={plan.id} delay={index * 90}>
                <div
                  className={cn(
                    "bg-surface flex h-full flex-col rounded-xl border p-7",
                    // The middle plan is the one most shops want, so it is the
                    // one the eye lands on — marked once, not shouted about.
                    plan.id === "standard"
                      ? "border-accent shadow-md"
                      : "border-border shadow-sm",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-xl">{plan.name}</p>
                    {plan.id === "standard" ? (
                      <span className="bg-accent-soft text-accent rounded-full px-2.5 py-0.5 text-[0.6875rem] font-medium">
                        Most shops
                      </span>
                    ) : null}
                  </div>

                  <p className="font-display mt-4 text-4xl">
                    {plan.priceMinor === 0
                      ? "Free"
                      : formatMoney(plan.priceMinor, plan.currency)}
                    {plan.priceMinor > 0 ? (
                      <span className="text-muted font-sans text-sm"> /month</span>
                    ) : null}
                  </p>

                  <p className="text-muted mt-3 text-sm leading-relaxed">{plan.blurb}</p>

                  <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                    {planLines(plan).map((line) => (
                      <li key={line} className="flex items-start gap-2.5 text-sm">
                        <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span className="text-text-secondary">{line}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    size="lg"
                    variant={plan.id === "standard" ? "primary" : "secondary"}
                    className="mt-7 w-full"
                  >
                    <Link href="/signup">
                      {plan.priceMinor === 0 ? "Create my store" : `Start on ${plan.name}`}
                    </Link>
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            {/*
             * Said plainly rather than in a footnote. The plans are real and the
             * limits are enforced, but nothing is being charged yet — and a
             * merchant who discovers that from a bank statement instead of from
             * us has been misled, whichever direction the surprise runs in.
             */}
            <p className="text-muted mx-auto mt-10 max-w-lg text-center text-sm text-balance">
              BuilderHut is early, so nothing is being charged yet — you can move between
              these today at no cost. We will ask before we ever bill you.
            </p>
          </Reveal>
        </Shell>
      </Section>

      <Section className="border-border bg-raised border-y">
        <Shell className="py-24">
          <SectionHead align="center" title="Side by side" />
          <Reveal delay={100} className="mt-12">
            <ComparisonTable />
          </Reveal>
        </Shell>
      </Section>

      <Section>
        <Shell className="py-24">
          <SectionHead align="center" title="Questions people ask." />
          <Reveal delay={100} className="mt-12">
            <Faq />
          </Reveal>
        </Shell>
      </Section>
    </main>
  );
}

/*
 * The comparison, generated from the catalogue rather than typed out.
 *
 * A hand-written table is the single most reliable place for a pricing page to
 * start lying: somebody raises a limit in the code and the table keeps the old
 * number for a year. Every row here is read from the same object the
 * entitlement checks read.
 */
const ROWS: { label: string; of: (plan: Plan) => string | boolean }[] = [
  { label: "Products", of: (p) => (p.limits.products === null ? "Unlimited" : `${p.limits.products}`) },
  { label: "People on the shop", of: (p) => (p.limits.staff === null ? "Unlimited" : `${p.limits.staff}`) },
  {
    label: "Your own domains",
    of: (p) => (p.limits.customDomains === 0 ? false : `${p.limits.customDomains}`),
  },
  {
    label: "Pictures",
    of: (p) =>
      p.limits.storageMb === null
        ? "Unlimited"
        : p.limits.storageMb >= 1000
          ? `${p.limits.storageMb / 1000} GB`
          : `${p.limits.storageMb} MB`,
  },
  { label: "Detailed analytics kept", of: (p) => `${p.limits.analyticsDays} days` },
  { label: "Discount codes", of: (p) => p.features.discountCodes },
  { label: "Marketing and basket reminders", of: (p) => p.features.marketingTools },
  { label: "Builder assistant", of: (p) => p.features.aiAssistant },
  { label: "Customers can sign in by phone", of: (p) => p.features.customerPhoneAuth },
  { label: "No BuilderHut line in your footer", of: (p) => p.features.removeBranding },
  { label: "Priority support", of: (p) => p.features.prioritySupport },
];

function ComparisonTable() {
  return (
    /*
     * Focusable, named, and with a visible focus ring.
     *
     * On a phone this table is wider than the screen, so it scrolls sideways —
     * and a scroll container that is not focusable can only be scrolled by
     * dragging it, which leaves it unreachable to anyone driving the page from
     * a keyboard or a switch. axe calls this scrollable-region-focusable, and
     * it is the violation the /pricing entry in e2e/a11y.spec.ts found the
     * first time it pointed at a real page instead of the 404.
     */
    <div
      tabIndex={0}
      role="region"
      aria-label="Plan comparison"
      className="focus-visible:outline-accent -mx-5 overflow-x-auto px-5 focus-visible:outline-2 focus-visible:outline-offset-2 sm:mx-0 sm:px-0"
    >
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">
          What is included on each BuilderHut plan
        </caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className="text-muted py-3 text-left font-normal">
              What you get
            </th>
            {ORDERED_PLANS.map((plan) => (
              <th key={plan.id} scope="col" className="font-display py-3 text-left text-base">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-border border-b">
              <th scope="row" className="text-text-secondary py-3 pr-4 text-left font-normal">
                {row.label}
              </th>
              {ORDERED_PLANS.map((plan) => {
                const value = row.of(plan);
                return (
                  <td key={plan.id} className="py-3 pr-4">
                    {/*
                     * A tick with no text is a cell a screen reader reads as
                     * nothing at all, and the whole table becomes a grid of
                     * silence. The word is there and hidden visually; the icon
                     * is what a sighted reader scans.
                     */}
                    {typeof value === "boolean" ? (
                      value ? (
                        <>
                          <Check className="text-success size-4" aria-hidden="true" />
                          <span className="sr-only">Included</span>
                        </>
                      ) : (
                        <>
                          <Minus className="text-faint size-4" aria-hidden="true" />
                          <span className="sr-only">Not included</span>
                        </>
                      )
                    ) : (
                      <span className="text-text">{value}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A plan's selling points, derived rather than written twice.
 *
 * The catalogue is the only place a limit is recorded, so a change to it moves
 * the pricing page too. A hand-written list beside it disagrees with the
 * software the first time somebody edits one of them.
 */
function planLines(plan: Plan): string[] {
  const lines = [
    plan.limits.products === null
      ? "As many products as you like"
      : `${plan.limits.products} products`,
    plan.limits.customDomains === 0
      ? "A free BuilderHut address"
      : plan.limits.customDomains === 1
        ? "Your own domain"
        : `${plan.limits.customDomains} of your own domains`,
    plan.limits.staff === null
      ? "As many people as you need"
      : plan.limits.staff === 1
        ? "Just you"
        : `${plan.limits.staff} people on the shop`,
    plan.limits.storageMb === null
      ? "As many pictures as you like"
      : `${plan.limits.storageMb >= 1000 ? `${plan.limits.storageMb / 1000} GB` : `${plan.limits.storageMb} MB`} of pictures`,
  ];

  if (plan.features.removeBranding) lines.push("No BuilderHut line in your footer");
  if (plan.features.discountCodes) lines.push("Discount codes");
  if (plan.features.marketingTools) lines.push("Marketing and abandoned baskets");
  if (plan.features.prioritySupport) lines.push("Priority support");

  return lines;
}
