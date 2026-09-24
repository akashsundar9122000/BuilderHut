import { StoreFrame } from "@/components/marketing/StoreFrame";
import { Shell, Eyebrow } from "@/components/marketing/Shell";
import { Reveal } from "@/components/marketing/Reveal";
import { cn } from "@/lib/cn";
import type { TemplateSummary } from "@/lib/templates";

/*
 * A shop being built, driven by the scroll.
 *
 * This is the page's reason to exist. Everyone selling a site builder says
 * "no code" — the only convincing version of that claim is watching a shop
 * turn up. So the four stages are not illustrations of the product, they are
 * the product's own renderer: StoreFrame reads the same theme the storefront
 * reads, which means this section cannot quietly start lying about what you
 * get.
 *
 * ── Rendered twice, on purpose ────────────────────────────────────────────
 *
 * A pinned scene and a plain stacked list, with CSS choosing between them
 * (styles/marketing.css) and `display: none` on the loser, so the hidden one
 * costs no paint. The stacked list is the default and gets the phone, the
 * reader who asked for less motion, and every browser without scroll
 * timelines — Firefox today, which is a real share of visitors rather than a
 * theoretical fallback. It is written to be a good section on its own.
 *
 * ── No client JavaScript at all ───────────────────────────────────────────
 *
 * The cross-fades, the step highlighting and the progress rail are scroll
 * timelines. StoreFrame is a server component and stays one, so no template
 * data and no theme logic cross the boundary. The whole scene adds nothing to
 * the bundle, which is what lets it be this elaborate — the budget gate is on
 * JavaScript, and there isn't any.
 */

export interface Stage {
  n: string;
  title: string;
  body: string;
}

export const STAGES: readonly Stage[] = [
  {
    n: "01",
    title: "Say what you make",
    body: "Crochet, cakes, invitations, silver, T-shirts. We show you the designs built for that trade rather than a generic grid.",
  },
  {
    n: "02",
    title: "Pick a starting point",
    body: "Not a blank page. A whole shop — type, colour, spacing, product cards — already dressed for what you sell.",
  },
  {
    n: "03",
    title: "Change it by clicking on it",
    body: "Words, colours, type and pictures. Click the thing you want to change and change it. No settings pages, no code, nothing to install.",
  },
  {
    n: "04",
    title: "Publish",
    body: "Your shop goes live at its own address straight away. Connect a domain when you're ready; the old links keep working.",
  },
];

/* The trades the first stage offers, kept short — it is a picture of a choice,
   not the real list, which lives on the page above it. */
const TRADE_CHIPS = ["Crochet", "Bakery", "Invitations", "Jewellery", "Prints"];

/**
 * The visual for one stage.
 *
 * Split out because both the pinned scene and the stacked list render all
 * four, and two copies of this that drifted apart would be the section
 * contradicting itself halfway down the page.
 */
function StageArt({ index, template }: { index: number; template: TemplateSummary }) {
  /*
   * `pt-9` on every stage, including the one with nothing above it. The badge
   * on stages three and four sits in that padding rather than on top of the
   * shop's own name, and because all four reserve the same space the frames do
   * not shift as the scene cross-fades between them.
   */
  if (index === 0)
    return (
      <div className="pt-9">
        <TradePicker />
      </div>
    );

  const selected = index === 2;
  const published = index === 3;

  return (
    <div className="relative pt-9">
      <StoreFrame
        template={template}
        productNames={
          published || selected
            ? ["Daisy posy", "Peony single", "Gift box"]
            : ["Product", "Product", "Product"]
        }
        className={cn(
          "shadow-lg transition-shadow",
          selected && "outline-accent outline-2 outline-offset-4",
        )}
      />

      {/*
       * Stage three has to show editing, and editing is a thing you do rather
       * than a thing a static picture has. So it shows the builder's own
       * selection ring and the chip that names what is selected — which is
       * what the builder actually draws when you click a heading.
       */}
      {selected ? (
        <span
          aria-hidden="true"
          className="bg-accent text-on-accent absolute top-0 left-4 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium shadow-md"
        >
          Heading · Fraunces
        </span>
      ) : null}

      {published ? (
        <span
          aria-hidden="true"
          className="bg-accent-2 text-on-accent absolute top-0 left-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium shadow-md"
        >
          <span className="bg-on-accent size-1.5 rounded-full" />
          Live
        </span>
      ) : null}
    </div>
  );
}

/** Stage one: the question the wizard opens with, before there is a shop. */
function TradePicker() {
  return (
    <div
      aria-hidden="true"
      className="border-border bg-surface rounded-[var(--bh-radius-lg)] border p-6 shadow-lg"
    >
      <p className="text-faint text-xs tracking-[0.14em] uppercase">What do you make?</p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {TRADE_CHIPS.map((trade, i) => (
          <span
            key={trade}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm",
              i === 0
                ? "border-accent bg-accent text-on-accent"
                : "border-border text-muted",
            )}
          >
            {trade}
          </span>
        ))}
      </div>
      <div className="border-border mt-6 space-y-2.5 border-t pt-5">
        <div className="bg-raised h-2.5 w-2/3 rounded-full" />
        <div className="bg-raised h-2.5 w-5/6 rounded-full" />
        <div className="bg-raised h-2.5 w-1/2 rounded-full" />
      </div>
    </div>
  );
}

export function BuildSequence({ template }: { template: TemplateSummary }) {
  return (
    <>
      {/* ── The pinned scene: wide screens, motion allowed, timelines supported ── */}
      <div
        className="bh-mk-seq__pinned"
        style={{ "--bh-seq-steps": STAGES.length } as React.CSSProperties}
      >
        <div className="bh-mk-seq__sticky flex items-center">
          <Shell className="w-full">
            <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">
              <div>
                <Eyebrow>How it works</Eyebrow>
                <h2 className="font-display mt-4 mb-10 max-w-md text-[clamp(1.9rem,1.4rem+2vw,2.7rem)] leading-[1.08]">
                  Zero to a live shop, in an afternoon.
                </h2>
                <div className="flex gap-7">
                {/* The rail: a track, and a fill scaled by the scroll. */}
                <div className="bg-border relative mt-2 w-px shrink-0">
                  <i className="bh-mk-seq__rail-fill bg-accent absolute inset-0 block" />
                </div>
                <ol className="space-y-9">
                  {STAGES.map((stage) => (
                    <li key={stage.n} className="bh-mk-seq__step">
                      <p className="text-accent font-mono text-xs">{stage.n}</p>
                      <p className="font-display mt-2 text-2xl leading-snug">{stage.title}</p>
                      <p className="text-muted mt-2 max-w-sm text-sm leading-relaxed">
                        {stage.body}
                      </p>
                    </li>
                  ))}
                </ol>
                </div>
              </div>

              <div className="grid">
                {STAGES.map((stage, i) => (
                  <div key={stage.n} className="bh-mk-seq__frame">
                    <StageArt index={i} template={template} />
                  </div>
                ))}
              </div>
            </div>
          </Shell>
        </div>
      </div>

      {/* ── The stacked list: phones, reduced motion, and browsers without
             scroll timelines. Not a fallback so much as the plain version. ── */}
      <div className="bh-mk-seq__stacked">
        <Shell className="py-24">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="font-display mt-4 max-w-xl text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-[1.08]">
              Zero to a live shop, in an afternoon.
            </h2>
          </Reveal>

          <ol className="mt-14 space-y-16">
            {STAGES.map((stage, i) => (
              <li key={stage.n}>
                <Reveal>
                  <div className="grid items-center gap-8 sm:grid-cols-2">
                    <div>
                      <p className="text-accent font-mono text-xs">{stage.n}</p>
                      <h3 className="font-display mt-2 text-2xl leading-snug">{stage.title}</h3>
                      <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">
                        {stage.body}
                      </p>
                    </div>
                    <StageArt index={i} template={template} />
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </Shell>
      </div>
    </>
  );
}
