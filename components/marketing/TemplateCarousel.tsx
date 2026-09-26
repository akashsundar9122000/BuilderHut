"use client";

import { AnimatePresence, m } from "motion/react";
import { useId, useRef, useState, ViewTransition } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { morphName, StoreFrame } from "./StoreFrame";
import { Tilt } from "./Tilt";
import { cn } from "@/lib/cn";
import { EASE_OUT, SPRING } from "@/lib/motion";
import type { TemplateSummary } from "@/lib/templates";

/*
 * The argument the landing page has to make: these are not one layout in a
 * dozen palettes. Switching tabs swaps the type pairing, the corner radius, the
 * spacing and the whole colour system at once, live — which is more convincing
 * than any sentence claiming it.
 *
 * ── Motion ────────────────────────────────────────────────────────────────
 *
 * One pill slides between the tabs (`layoutId`, on the `snap` spring), and the
 * shop and its facts cross-fade rather than being swapped on a remount. Under
 * reduced motion MotionRoot sets `reducedMotion: "always"`, which makes both
 * of those instant without this file branching on anything.
 *
 * ── Keyboard ──────────────────────────────────────────────────────────────
 *
 * It announces itself as tabs, so it behaves like tabs: one tab stop for the
 * whole row, arrow keys (and Home / End) to move along it, and the panel
 * labelled by the tab that shows it. It used to be twelve separate tab stops
 * with `role="tab"` and none of the behaviour the role promises.
 */
export function TemplateCarousel({ templates }: { templates: TemplateSummary[] }) {
  const [active, setActive] = useState(templates[0]!.id);
  const current = templates.find((t) => t.id === active) ?? templates[0]!;
  const base = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, to: number) => {
    const next = (to + templates.length) % templates.length;
    if (next === from) return;
    setActive(templates[next]!.id);
    tabs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) move(index, index + step);
    else if (e.key === "Home") move(index, 0);
    else if (e.key === "End") move(index, templates.length - 1);
    else return;
    e.preventDefault();
  };

  const fade = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.35, ease: EASE_OUT },
  } as const;

  return (
    <div>
      <div
        className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="tablist"
        aria-label="Templates"
      >
        {templates.map((template, index) => {
          const selected = template.id === active;
          return (
            <button
              key={template.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              id={`${base}-tab-${template.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(template.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "coarse:min-h-11 relative shrink-0 rounded-full border px-4 py-2 text-sm",
                "transition-colors duration-(--bh-duration-fast) ease-(--ease-out)",
                selected
                  ? "border-accent text-on-accent"
                  : "border-border text-text-secondary hover:border-border-strong hover:bg-raised",
              )}
            >
              {selected ? (
                <m.span
                  layoutId={`${base}-pill`}
                  aria-hidden="true"
                  className="bg-accent absolute inset-0 rounded-full"
                  transition={SPRING.snap}
                />
              ) : null}
              <span className="relative">{template.name}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={`${base}-tab-${current.id}`}
        className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
      >
        <Tilt>
          {/*
           * `popLayout` so the outgoing shop is taken out of flow as it fades:
           * the incoming one takes its place immediately and the section below
           * never jumps by the difference in their heights.
           */}
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div key={current.id} {...fade}>
              <ViewTransition name={morphName(current.id)} share="bh-morph" default="none">
                <StoreFrame template={current} className="shadow-lg" />
              </ViewTransition>
            </m.div>
          </AnimatePresence>
        </Tilt>

        <AnimatePresence mode="wait" initial={false}>
          <m.div key={current.id} className="lg:pt-6" {...fade}>
            <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
              {current.name}
            </p>
            <p className="font-display mt-3 text-2xl leading-snug">{current.blurb}</p>

            <dl className="mt-6 flex flex-col gap-3 text-sm">
              <div className="border-border flex gap-4 border-b pb-3">
                <dt className="text-muted w-28 shrink-0">Built for</dt>
                <dd className="text-text">
                  {current.industries
                    .filter((i) => i !== "other")
                    .slice(0, 3)
                    .join(", ")}
                </dd>
              </div>
              <div className="border-border flex gap-4 border-b pb-3">
                <dt className="text-muted w-28 shrink-0">Type</dt>
                <dd className="text-text capitalize">
                  {current.theme.typography.heading} &amp; {current.theme.typography.body}
                </dd>
              </div>
              <div className="border-border flex gap-4 border-b pb-3">
                <dt className="text-muted w-28 shrink-0">Corners</dt>
                <dd className="text-text">
                  {current.theme.shape.radius === 0 ? "Sharp" : `${current.theme.shape.radius}px`}
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="text-muted w-28 shrink-0">Palette</dt>
                <dd className="flex gap-1.5">
                  {current.swatches.map((swatch) => (
                    <span
                      key={swatch}
                      className="border-border size-5 rounded-full border"
                      style={{ background: swatch }}
                      title={swatch}
                    />
                  ))}
                </dd>
              </div>
            </dl>

            <Link
              href={`/templates/${current.id}`}
              className="text-accent hover:text-accent-hover group mt-6 inline-flex items-center gap-1 text-sm font-medium"
            >
              See {current.name} in full
              <ArrowRight
                className="size-3.5 transition-transform duration-(--bh-duration-fast) group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Link>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
