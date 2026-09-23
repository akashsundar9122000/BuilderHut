import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";

import { Faq } from "@/components/marketing/Faq";
import { Reveal } from "@/components/marketing/Reveal";
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

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <Reveal>
          <h2 className="font-display text-center text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]">
            Free while we build it.
          </h2>
          <p className="text-muted mx-auto mt-4 max-w-lg text-center text-balance">
            BuilderHut is early. Building and running a store costs nothing, and it will
            keep costing nothing at its BuilderHut address.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="border-border bg-surface mx-auto mt-12 max-w-md rounded-xl border p-8 shadow-sm">
            <p className="text-muted text-xs tracking-[0.14em] uppercase">Everything, today</p>
            <p className="font-display mt-3 text-5xl">Free</p>
            <ul className="mt-7 flex flex-col gap-3">
              {[
                "One store, unlimited products",
                "Every template",
                "A free BuilderHut address",
                "Your own catalogue and orders",
                "Exports — your data stays yours",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="text-success mt-0.5 size-4 shrink-0" />
                  <span className="text-text-secondary">{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-8 w-full">
              <Link href="/signup">Create my store</Link>
            </Button>
            <p className="text-faint mt-4 text-center text-xs">
              Paid plans will exist. You will be asked, not billed.
            </p>
          </div>
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
