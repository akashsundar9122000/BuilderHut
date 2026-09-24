import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

import { Reveal } from "@/components/marketing/Reveal";
import { StoreFrame } from "@/components/marketing/StoreFrame";
import { Button } from "@/components/ui";
import { INDUSTRIES, industryById } from "@/lib/industries";
import { buildDocument, templateSummary, TEMPLATES } from "@/lib/templates";

/*
 * Spelled out, and derived. The count used to be typed into the headline, and
 * it was wrong the day the seventh template shipped.
 */
const NUMBER_WORDS = [
  "No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen",
  "Nineteen", "Twenty",
];

const COUNT = NUMBER_WORDS[TEMPLATES.length] ?? String(TEMPLATES.length);

export const metadata: Metadata = {
  title: "Templates",
  description: `${COUNT} starting points, each designed for a different trade. Every one is fully editable.`,
};

/*
 * Blueprint section 45's template gallery.
 *
 * Each card shows the template's real palette and type, plus honest facts —
 * how many pages it comes with, which trades it was designed for. "Preview"
 * without signing up is explicitly required, and it is also the right call:
 * asking someone to create an account to find out whether they want one is a
 * good way to make sure they don't.
 */
export default function TemplatesPage() {
  const cards = TEMPLATES.map((template) => {
    const doc = buildDocument(template.id, {
      storeName: template.name,
      tagline: "",
      industry: template.industries[0]!,
    });
    return { template: templateSummary(template), pageCount: doc.pages.length };
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
      <Reveal>
        <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">Templates</p>
        <h1 className="font-display mt-4 max-w-2xl text-[clamp(2.2rem,1.6rem+2.4vw,3.6rem)] leading-[1.05]">
          {COUNT} starting points, each built for a different trade.
        </h1>
        <p className="text-muted mt-5 max-w-xl text-balance">
          Every one is a real design — its own typefaces, spacing and shapes, not a
          recolour. Pick whichever is closest; you can change all of it afterwards.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-x-8 gap-y-14 md:grid-cols-2">
        {cards.map(({ template, pageCount }, i) => (
          <Reveal key={template.id} delay={(i % 2) * 90}>
            <article>
              <StoreFrame template={template} className="shadow-md" />

              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-display text-xl">{template.name}</h2>
                  <div className="flex gap-1.5">
                    {template.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="border-border size-4 rounded-full border"
                        style={{ background: swatch }}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-muted mt-2 text-sm leading-relaxed">{template.blurb}</p>

                <p className="text-faint mt-3 text-xs">
                  {pageCount} pages · {template.theme.typography.heading} &amp;{" "}
                  {template.theme.typography.body} ·{" "}
                  {template.theme.shape.radius === 0
                    ? "sharp corners"
                    : `${template.theme.shape.radius}px corners`}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {template.industries
                    .filter((id) => id !== "other")
                    .map((id) => (
                      <span
                        key={id}
                        className="border-border text-text-secondary rounded-full border px-2.5 py-1 text-xs"
                      >
                        {industryById(id)?.label ?? id}
                      </span>
                    ))}
                </div>

                {/*
                  * Look before you commit. This used to go straight to signup,
                  * which asks somebody to create an account to find out whether
                  * the design is any good — and this page's own argument is
                  * that you have to see one to tell.
                  */}
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/templates/${template.id}`}>
                      Preview {template.name} <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/signup?template=${template.id}`}>Start with it</Link>
                  </Button>
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="border-border mt-20 border-t pt-14 text-center">
          <h2 className="font-display text-2xl">Not sure which?</h2>
          <p className="text-muted mx-auto mt-3 max-w-md text-sm text-balance">
            Tell us what you make during setup and we&rsquo;ll put the ones built for your
            trade first. There are {INDUSTRIES.length - 1} to choose from.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/signup">Create my store</Link>
          </Button>
        </div>
      </Reveal>
    </main>
  );
}
