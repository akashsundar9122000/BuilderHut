import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";

import { Faq } from "@/components/marketing/Faq";
import { Reveal } from "@/components/marketing/Reveal";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { ORDERED_PLANS, type Plan } from "@/lib/plans/catalog";
import { StoreFrame } from "@/components/marketing/StoreFrame";
import { TemplateCarousel } from "@/components/marketing/TemplateCarousel";
import { Button } from "@/components/ui";
import { INDUSTRIES } from "@/lib/industries";
import { templateSummaries, templateSummary, TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = {
  title: "BuilderHut — Sell what you make",
  description:
    "Build a proper online shop without writing code. Pick a starting point that suits what you make, change everything by clicking on it, add your products, and publish.",
};

/*
 * The landing page.
 *
 * Blueprint section 0.1 asks for a premium product launch rather than a
 * conventional SaaS homepage, and specifically for the first viewport to
 * demonstrate what the builder can produce. So the hero carries a real
 * storefront drawn from a real template's tokens — not a screenshot, not a
 * mockup. If the templates change, this page changes with them, and it cannot
 * quietly start lying about the product.
 */

/*
 * Three doors, not one link. The three audiences want genuinely different
 * things, and a single "Read the guide" button sends a shop owner into the API
 * reference.
 */
const GUIDE_DOORS = [
  {
    href: "/guide/start/welcome",
    title: "Using BuilderHut",
    body: "From signing up to taking your first order. Every screen, in plain words, with pictures of the real thing.",
    cta: "Start reading",
  },
  {
    href: "/guide/api/overview",
    title: "API and MCP",
    body: "A REST API for your shop’s products, orders and customers — and an MCP server so an assistant can use it.",
    cta: "See the reference",
  },
  {
    href: "/guide/engineering/architecture",
    title: "How it is built",
    body: "Tenancy, the document model behind the builder, the render pipeline, and the gates that keep it honest.",
    cta: "Read the notes",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Say what you make",
    body: "Crochet, cakes, invitations, silver, T-shirts. We show you the designs built for that trade rather than a generic grid.",
  },
  {
    n: "02",
    title: "Make it yours",
    body: "Change the words, the colours, the type and the pictures by clicking on them. No settings pages, no code, nothing to install.",
  },
  {
    n: "03",
    title: "Add what you sell",
    body: "A photo, a name and a price. Prices are kept exactly — no rounding, no floating point, no surprises at checkout.",
  },
  {
    n: "04",
    title: "Publish",
    body: "Your shop goes live at its own address straight away. Connect a domain when you're ready; the old links keep working.",
  },
];

export default function LandingPage() {
  const hero = templateSummary(TEMPLATES.find((t) => t.id === "thread")!);
  const second = templateSummary(TEMPLATES.find((t) => t.id === "cutline")!);

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* A single restrained wash, not a purple SaaS gradient across everything. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
          style={{
            background:
              "radial-gradient(60% 70% at 15% 0%, var(--bh-accent-soft) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 sm:px-8 sm:pt-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pb-28">
          <div>
            <Reveal>
              <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
                For people who make things
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display mt-5 text-[clamp(2.6rem,1.6rem+4vw,4.6rem)] leading-[1.02]">
                Sell what you make.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-muted mt-6 max-w-md text-lg leading-relaxed text-balance">
                A proper online shop — cart, checkout, the lot — without writing a line
                of code. Pick a starting point built for your trade, then change
                everything by clicking on it.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href="/signup">
                    Create my store <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/templates">Explore templates</Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <p className="text-faint mt-5 text-xs">
                Free to build. No card, no trial countdown.
              </p>
            </Reveal>
          </div>

          <Reveal delay={200}>
            {/* Two frames, offset — the second says "and it also looks like this". */}
            <div className="relative">
              <StoreFrame template={hero} className="shadow-lg" />
              <div className="absolute -right-3 -bottom-10 hidden w-[52%] sm:block lg:-right-8">
                <StoreFrame
                  template={second}
                  productNames={["Tee 01", "Tee 02", "Cap"]}
                  className="shadow-lg"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Trades ───────────────────────────────────────────────────────── */}
      <section className="border-border border-y">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <p className="text-faint text-center text-xs tracking-[0.14em] uppercase">
            Built for
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-3">
            {INDUSTRIES.filter((i) => i.id !== "other").map((industry, i) => (
              <Reveal key={industry.id} delay={i * 35}>
                <span className="text-text-secondary text-sm">{industry.label}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Templates ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8" id="templates">
        <Reveal>
          <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
            Starting points
          </p>
          <h2 className="font-display mt-4 max-w-xl text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]">
            A bakery should not look like a streetwear label.
          </h2>
          <p className="text-muted mt-4 max-w-lg text-balance">
            Every design here has its own typefaces, spacing and shapes — not one
            layout in a dozen colours. Switch between them and watch the whole thing
            change.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-12">
          <TemplateCarousel templates={templateSummaries()} />
        </Reveal>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="bg-raised border-border border-y">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <h2 className="font-display max-w-xl text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]">
              Zero to a live shop, in an afternoon.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 90}>
                <p className="text-accent font-mono text-xs">{step.n}</p>
                <h3 className="font-display mt-3 text-xl leading-snug">{step.title}</h3>
                <p className="text-muted mt-2.5 text-sm leading-relaxed">{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Guide ────────────────────────────────────────────────────────── */}
      <section id="guide" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">The guide</p>
          <h2 className="font-display mt-4 max-w-xl text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]">
            Every screen, explained in plain words.
          </h2>
          <p className="text-muted mt-4 max-w-lg text-balance">
            Written for the person using it, not a help centre of ticket answers. Free to read,
            and you do not need an account.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {GUIDE_DOORS.map((door, i) => (
            <Reveal key={door.href} delay={i * 90}>
              <Link
                href={door.href}
                className="border-border bg-surface hover:border-accent-border group flex h-full flex-col rounded-[var(--bh-radius-lg)] border p-6 transition-colors"
              >
                <h3 className="font-display text-xl leading-snug">{door.title}</h3>
                <p className="text-muted mt-2.5 flex-1 text-sm leading-relaxed">{door.body}</p>
                <span className="text-accent mt-4 inline-flex items-center gap-1 text-sm font-medium">
                  {door.cta}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <h2 className="font-display text-center text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]">
            Start free. Pay when it&rsquo;s earning.
          </h2>
          <p className="text-muted mx-auto mt-4 max-w-lg text-center text-balance">
            A real shop at a BuilderHut address costs nothing. You only pay when you want
            your own domain, your own staff, or the BuilderHut line out of your footer.
          </p>
        </Reveal>

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
                  {plan.priceMinor === 0 ? "Free" : formatMoney(plan.priceMinor, plan.currency)}
                  {plan.priceMinor > 0 ? (
                    <span className="text-muted font-sans text-sm"> /month</span>
                  ) : null}
                </p>

                <p className="text-muted mt-3 text-sm leading-relaxed">{plan.blurb}</p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {planLines(plan).map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm">
                      <Check className="text-success mt-0.5 size-4 shrink-0" />
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
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-border bg-raised border-y">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <Reveal>
            <h2 className="font-display mb-12 text-center text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]">
              Questions people ask.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <Faq />
          </Reveal>
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 py-28 text-center sm:px-8">
        <Reveal>
          <h2 className="font-display text-[clamp(2.1rem,1.5rem+2.6vw,3.6rem)] leading-[1.05]">
            Your shop is about twenty minutes away.
          </h2>
          <p className="text-muted mx-auto mt-5 max-w-md text-balance">
            Pick a starting point, add a few photographs, and put it in your bio.
          </p>
          <Button asChild size="lg" className="mt-9">
            <Link href="/signup">
              Create my store <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Reveal>
      </section>
    </main>
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
