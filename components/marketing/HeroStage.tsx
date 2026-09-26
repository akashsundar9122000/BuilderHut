"use client";

import { m, useAnimationControls } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { BrowserFrame } from "@/components/marketing/BrowserFrame";
import { cn } from "@/lib/cn";
import { EASE_OUT, HERO_CYCLE, SPRING } from "@/lib/motion";
import { useMotion } from "@/lib/use-motion";

/*
 * The hero's product demo: a shop that re-dresses itself.
 *
 * Bookie's hero is a car that drives in. This product's equivalent is the
 * thing it actually does — one shop, several complete designs — so the frame
 * builds itself on arrival (CSS, see `.bh-mk-assemble`) and then, every few
 * seconds, a drawn cursor goes to the next swatch and the whole shop changes
 * type, colour and shape at once.
 *
 * ── What is real ───────────────────────────────────────────────────────────
 *
 * Every frame is a StoreFrame rendered on the SERVER from the template's real
 * theme and handed in as a prop, so no template data or theme logic crosses
 * into this bundle, and the page's rule that nothing on it is a screenshot
 * still holds. The swatches are real buttons: the cursor only ever does what a
 * reader can do themselves.
 *
 * ── When it stops ──────────────────────────────────────────────────────────
 *
 * Content that changes on its own for longer than five seconds needs a way to
 * stop it (WCAG 2.2.2), and it needs to stop for the right reasons without
 * being asked. So it does not advance:
 *   - under reduced motion (it never starts — a mount gate, not a slowdown);
 *   - while the pointer or keyboard focus is anywhere inside it;
 *   - while it is off screen, or the tab is in the background;
 *   - ever again, once somebody picks a template or presses Pause. A demo that
 *     carries on after you have taken the controls is fighting you.
 */

export interface HeroFrame {
  id: string;
  name: string;
  /** Background and primary, for the swatch — template data, not UI colour. */
  swatch: readonly [string, string];
  frame: React.ReactNode;
}

export function HeroStage({
  frames,
  overlay,
}: {
  frames: HeroFrame[];
  /** Decoration that hangs off the browser frame (the floating second shop, the chip). */
  overlay?: React.ReactNode;
}) {
  const motion = useMotion();
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [held, setHeld] = useState(false); // hover or focus inside
  const [visible, setVisible] = useState(true); // on screen and tab in front
  const [heading, setAim] = useState<number | null>(null); // where the cursor last set off for

  const root = useRef<HTMLDivElement>(null);
  const swatches = useRef<(HTMLButtonElement | null)[]>([]);
  const press = useAnimationControls();

  const running = motion === "full" && !stopped && !held && visible;
  // Derived rather than reset in an effect: the cursor is only ever on its way
  // somewhere while the cycle is running, and hides the moment it is not.
  const aim = running && heading !== null && heading !== active ? heading : null;

  /* Off screen, or a background tab: no point changing what nobody can see. */
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = !!entry?.isIntersecting;
      update();
    });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  /* The cycle: the cursor sets off, then the switch lands under it. */
  useEffect(() => {
    if (!running) return;
    const next = (active + 1) % frames.length;
    const go = window.setTimeout(() => setAim(next), HERO_CYCLE.dwellMs - HERO_CYCLE.cursorLeadMs);
    const land = window.setTimeout(() => {
      void press.start({ scale: [1, 0.82, 1], transition: { duration: 0.32, ease: EASE_OUT } });
      setActive(next);
    }, HERO_CYCLE.dwellMs);
    return () => {
      window.clearTimeout(go);
      window.clearTimeout(land);
    };
  }, [running, active, frames.length, press]);

  /* Where the aimed-at swatch sits, relative to the stage. Measured, because
     the row wraps differently at every width. */
  const [cursorAt, setCursorAt] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    if (aim === null) return;
    const target = swatches.current[aim];
    const box = root.current?.getBoundingClientRect();
    if (!target || !box) return;
    const r = target.getBoundingClientRect();
    setCursorAt({ x: r.left - box.left + 14, y: r.top - box.top + r.height / 2 });
  }, [aim]);

  const choose = useCallback((index: number) => {
    setStopped(true);
    setActive(index);
  }, []);

  const current = frames[active]!;

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
    >
      <div className="relative">
        <BrowserFrame url={`${current.id}.builderhut.app`}>
          {/*
           * All frames stacked in one grid cell, so the stage is as tall as the
           * tallest and never changes height as it crossfades — a hero that
           * jumps by twenty pixels every five seconds moves the headline next
           * to it, which is exactly what a reader is trying to read.
           */}
          <div className="grid">
            {frames.map((f, i) => (
              <m.div
                key={f.id}
                className="grid [grid-area:1/1]"
                initial={false}
                animate={{ opacity: i === active ? 1 : 0, scale: i === active ? 1 : 0.985 }}
                transition={{ duration: HERO_CYCLE.crossfade, ease: EASE_OUT }}
                aria-hidden={i !== active}
                inert={i !== active}
              >
                {f.frame}
              </m.div>
            ))}
          </div>
        </BrowserFrame>
        {overlay}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-16">
        <div
          role="group"
          aria-label="Show this shop in another design"
          className="flex flex-wrap gap-2"
        >
          {frames.map((f, i) => (
            <button
              key={f.id}
              ref={(node) => {
                swatches.current[i] = node;
              }}
              type="button"
              aria-pressed={i === active}
              onClick={() => choose(i)}
              className={cn(
                "coarse:min-h-11 coarse:min-w-11 inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-3 text-xs",
                "transition-colors duration-(--bh-duration-fast) ease-(--ease-out)",
                i === active
                  ? "border-border-strong bg-raised text-text"
                  : "border-border text-muted hover:text-text hover:border-border-strong",
              )}
            >
              <span
                aria-hidden="true"
                className="border-border inline-flex size-4 overflow-hidden rounded-full border"
              >
                <span className="h-full w-1/2" style={{ background: f.swatch[0] }} />
                <span className="h-full w-1/2" style={{ background: f.swatch[1] }} />
              </span>
              {/* On a phone the dots alone fit one row at the 44px touch
                  floor; four names and a pause button wrapped to three. */}
              <span className="max-sm:sr-only">{f.name}</span>
            </button>
          ))}
        </div>

        {/* The stop control 2.2.2 asks for. Absent when nothing is moving. */}
        {motion === "full" && !stopped ? (
          <button
            type="button"
            onClick={() => setStopped(true)}
            className="coarse:size-11 text-muted hover:text-text inline-flex size-9 items-center justify-center rounded-full transition-colors duration-(--bh-duration-fast)"
            aria-label="Stop changing designs"
            title="Stop changing designs"
          >
            <Pause className="size-3.5" aria-hidden="true" />
          </button>
        ) : motion === "full" ? (
          <button
            type="button"
            onClick={() => setStopped(false)}
            className="coarse:size-11 text-muted hover:text-text inline-flex size-9 items-center justify-center rounded-full transition-colors duration-(--bh-duration-fast)"
            aria-label="Keep changing designs"
            title="Keep changing designs"
          >
            <Play className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/*
       * The drawn cursor. Decoration — it shows what the swatches do, and
       * every move it makes is a button a reader can press themselves. Hidden
       * on phones, where there is no cursor to recognise.
       */}
      {motion === "full" ? (
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 hidden sm:block"
          initial={false}
          animate={{
            x: cursorAt.x,
            y: cursorAt.y,
            opacity: aim === null ? 0 : 1,
          }}
          transition={{ ...SPRING.glide, opacity: { duration: 0.25 } }}
        >
          <m.svg animate={press} width="18" height="22" viewBox="0 0 18 22" className="drop-shadow-md">
            <path
              d="M1.5 1.5v16.2l4.3-4 2.9 6.6 3-1.3-2.9-6.5h6z"
              className="fill-text stroke-canvas"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </m.svg>
        </m.div>
      ) : null}
    </div>
  );
}
