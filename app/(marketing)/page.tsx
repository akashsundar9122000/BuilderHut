import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { BuildSequence } from "@/components/marketing/BuildSequence";
import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { Faq } from "@/components/marketing/Faq";
import { Marquee } from "@/components/marketing/Marquee";
import { Reveal } from "@/components/marketing/Reveal";
import { Backdrop, Section, SectionHead, Shell, Eyebrow } from "@/components/marketing/Shell";
import { Stagger } from "@/components/marketing/Stagger";
import { StoreFrame } from "@/components/marketing/StoreFrame";
import { TemplateCarousel } from "@/components/marketing/TemplateCarousel";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { INDUSTRIES } from "@/lib/industries";
import { FEATURES, GUIDE_DOORS, PRINCIPLES } from "@/lib/marketing/content";
import { ORDERED_PLANS } from "@/lib/plans/catalog";
import { formatMoney } from "@/lib/money";
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
 * demonstrate what the builder can produce.
 *
 * ── Two rules this page is built on ───────────────────────────────────────
 *
 * 1. Everything shown is rendered by the product. The hero, the build sequence
 *    and the gallery all go through StoreFrame, which reads the same theme the
 *    live storefront renderer reads. There is not one screenshot on this page.
 *    A screenshot is a promise about software that has since changed; this
 *    cannot drift, because if the templates change, the page changes with them.
 *
 * 2. Nothing is invented. No merchant counts, no testimonials, no logo wall —
 *    there are no merchants yet. The trades come from lib/industries, the
 *    plans from lib/plans/catalog, the templates from lib/templates.
 *
 * ── The theatre ───────────────────────────────────────────────────────────
 *
 * The hero, the build sequence and the closing call are always dark, whatever
 * the reader's theme; everything between them stays on bone and follows the
 * toggle. That is one attribute, `data-surface="theatre"`, because @theme
 * inline emits var(--bh-*) rather than resolved values, so overriding those
 * variables on a scope re-skins every utility inside it. See styles/tokens.css.
 */

export default function LandingPage() {
  const hero = templateSummary(TEMPLATES.find((t) => t.id === "thread")!);
  const second = templateSummary(TEMPLATES.find((t) => t.id === "cutline")!);
  const trades = INDUSTRIES.filter((i) => i.id !== "other").map((i) => i.label);
  const cheapestPaid = ORDERED_PLANS.find((p) => p.priceMinor > 0);

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Section surface="theatre" className="border-border border-b">
        <Backdrop>
          <div className="bh-mk-grid" />
          <div className="bh-mk-glow -top-40 -left-32 size-[46rem]" />
        </Backdrop>
        <Shell className="relative grid items-center gap-14 pt-20 pb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:pt-28 lg:pb-32">
          <div>
            <Reveal>
              <Eyebrow>For people who make things</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display mt-5 text-[clamp(2.7rem,1.6rem+4.4vw,5rem)] leading-[1.01]">
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
                    Create my store <ArrowRight className="size-4" aria-hidden="true" />
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
            <div className="bh-mk-parallax relative">
              {/*
               * The window chrome is drawn, not photographed, because what is
               * inside it is live — a screenshot of a browser around a
               * component that re-renders itself would be the only stale pixel
               * on the page.
               */}
              <BrowserFrame url="thread.builderhut.app">
                <StoreFrame template={hero} />
              </BrowserFrame>

              <div className="absolute -right-3 -bottom-12 hidden w-[52%] sm:block lg:-right-9">
                <div className="bh-mk-bob">
                  <StoreFrame
                    template={second}
                    productNames={["Tee 01", "Tee 02", "Cap"]}
                    className="shadow-lg"
                  />
                </div>
              </div>

              {/*
               * Two facts, floating. Both are true of the software rather than
               * aspirational: twelve is the number of templates in
               * lib/templates, and the address is what a shop gets on publish.
               */}
              <span
                aria-hidden="true"
                className="bh-mk-bob bh-mk-bob--slow border-border bg-surface text-text-secondary absolute -top-4 -left-4 hidden rounded-full border px-3.5 py-1.5 text-xs shadow-md lg:block"
              >
                {TEMPLATES.length} starting points
              </span>
            </div>
          </Reveal>
        </Shell>
      </Section>

      {/* ── Trades ───────────────────────────────────────────────────────── */}
      <Section className="border-border border-b">
        <Shell className="py-10">
          <p className="text-faint text-center text-xs tracking-[0.14em] uppercase">
            Built for
          </p>
          {/*
           * The trades themselves, moving — not a wall of borrowed logos.
           * There are no customer logos to show and inventing them is the
           * oldest lie on a landing page.
           */}
          <Marquee className="mt-5" items={trades} label="Trades BuilderHut has designs for" />
        </Shell>
      </Section>

      {/* ── The build sequence ───────────────────────────────────────────── */}
      <Section id="how" surface="theatre" className="border-border border-b">
        <Backdrop>
          <div className="bh-mk-glow top-1/3 -right-40 size-[40rem]" />
        </Backdrop>
        <BuildSequence template={hero} />
      </Section>

      {/* ── Templates ────────────────────────────────────────────────────── */}
      <Section id="templates">
        <Shell className="py-24">
          <SectionHead
            eyebrow="Starting points"
            title="A bakery should not look like a streetwear label."
            sub="Every design here has its own typefaces, spacing and shapes — not one layout in a dozen colours. Switch between them and watch the whole thing change."
          />
          <Reveal delay={120} className="mt-12">
            <TemplateCarousel templates={templateSummaries()} />
          </Reveal>
        </Shell>
      </Section>

      {/* ── What you get ─────────────────────────────────────────────────── */}
      <Section className="border-border bg-raised border-y">
        <Shell className="py-24">
          <SectionHead
            eyebrow="What you get"
            title="A shop, not a page about a shop."
            sub="The unglamorous half — the part that takes the money and tells you what sold — is the half that decides whether this was worth doing."
          />
          <Stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  "border-border bg-surface flex flex-col rounded-[var(--bh-radius-lg)] border p-6",
                  feature.span === 2 && "lg:col-span-2",
                  feature.span === 3 && "lg:col-span-3",
                )}
              >
                <h3 className="font-display text-xl leading-snug">{feature.title}</h3>
                <p className="text-muted mt-2.5 text-sm leading-relaxed">{feature.body}</p>
              </div>
            ))}
          </Stagger>
        </Shell>
      </Section>

      {/* ── Built properly ───────────────────────────────────────────────── */}
      <Section>
        <Shell className="py-24">
          <SectionHead
            eyebrow="Underneath"
            title="Boring where it counts."
            sub="Three decisions you should not have to think about, made carefully so that you do not. Each one is written out in full in the engineering notes."
          />
          <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <div
                key={principle.title}
                className="border-border bg-surface flex flex-col rounded-[var(--bh-radius-lg)] border p-6"
              >
                <h3 className="font-display text-xl leading-snug">{principle.title}</h3>
                <p className="text-muted mt-2.5 flex-1 text-sm leading-relaxed">
                  {principle.body}
                </p>
                <Link
                  href={principle.href}
                  className="text-accent hover:text-accent-hover mt-4 inline-flex items-center gap-1 text-sm font-medium"
                >
                  {principle.linkLabel}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </Stagger>
        </Shell>
      </Section>

      {/* ── Guide ────────────────────────────────────────────────────────── */}
      <Section id="guide" className="border-border bg-raised border-y">
        <Shell className="py-24">
          <SectionHead
            eyebrow="The guide"
            title="Every screen, explained in plain words."
            sub="Written for the person using it, not a help centre of ticket answers. Free to read, and you do not need an account."
          />
          <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
            {GUIDE_DOORS.map((door) => (
              <Link
                key={door.href}
                href={door.href}
                className="border-border bg-surface hover:border-accent-border group flex h-full flex-col rounded-[var(--bh-radius-lg)] border p-6 transition-colors"
              >
                <h3 className="font-display text-xl leading-snug">{door.title}</h3>
                <p className="text-muted mt-2.5 flex-1 text-sm leading-relaxed">{door.body}</p>
                <span className="text-accent mt-4 inline-flex items-center gap-1 text-sm font-medium">
                  {door.cta}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            ))}
          </Stagger>
        </Shell>
      </Section>

      {/* ── Pricing, in one line ─────────────────────────────────────────── */}
      <Section id="pricing">
        <Shell className="py-24">
          <SectionHead
            align="center"
            eyebrow="Pricing"
            title={<>Start free. Pay when it&rsquo;s earning.</>}
            sub={
              cheapestPaid
                ? `A real shop at a BuilderHut address costs nothing, for as long as you like. Paid plans start at ${formatMoney(cheapestPaid.priceMinor, cheapestPaid.currency)} a month, and nothing is being charged yet.`
                : "A real shop at a BuilderHut address costs nothing, for as long as you like."
            }
          />
          <Reveal delay={120}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Create my store <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/pricing">See what&rsquo;s included</Link>
              </Button>
            </div>
          </Reveal>
        </Shell>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section className="border-border bg-raised border-y">
        <Shell className="py-24">
          <SectionHead align="center" title="Questions people ask." />
          <Reveal delay={100} className="mt-12">
            <Faq />
          </Reveal>
        </Shell>
      </Section>

      {/* ── Closing ──────────────────────────────────────────────────────── */}
      <Section surface="theatre">
        <Backdrop>
          <div className="bh-mk-glow bh-mk-breathe top-0 left-1/2 size-[38rem] -translate-x-1/2" />
        </Backdrop>
        <Shell className="relative max-w-3xl! py-28 text-center">
          <Reveal>
            <h2 className="font-display text-[clamp(2.1rem,1.5rem+2.6vw,3.6rem)] leading-[1.05]">
              Your shop is about twenty minutes away.
            </h2>
            <p className="text-muted mx-auto mt-5 max-w-md text-balance">
              Pick a starting point, add a few photographs, and put it in your bio.
            </p>
            <Button asChild size="lg" className="mt-9">
              <Link href="/signup">
                Create my store <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </Reveal>
        </Shell>
      </Section>
    </main>
  );
}
