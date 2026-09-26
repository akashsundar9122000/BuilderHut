"use client";

import { animate } from "motion/react";
import { useEffect, useRef } from "react";

import { COUNT_UP_S, EASE_OUT, prefersReducedMotion } from "@/lib/motion";

/*
 * A number that counts up to itself when it scrolls into view. Bookie's
 * CountUp, with two of its decisions kept on purpose:
 *
 *   - The server renders the FINAL value. With no JavaScript, under reduced
 *     motion, or for a crawler, the number is simply right. The count is an
 *     entrance, never the source of the figure.
 *   - The final value's width is held by an invisible copy in the same grid
 *     cell, so "8" becoming "12" does not shove the label beside it.
 *
 * The frames write to the node's text directly rather than through state: a
 * 1.4s count is ~84 frames, and 84 renders of a number is a strange thing to
 * spend React on. The visible digits are aria-hidden and the real value is
 * given once, so a screen reader does not announce a count of 0, 1, 2…
 */
export function CountUp({
  value,
  prefix = "",
  className,
}: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  const shown = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = shown.current;
    if (!node || prefersReducedMotion() || typeof IntersectionObserver !== "function") return;

    // Already on screen when the page loads: leave the real number alone
    // rather than blanking it to 0 in front of somebody reading it.
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    let controls: ReturnType<typeof animate> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        controls = animate(0, value, {
          duration: COUNT_UP_S,
          ease: EASE_OUT,
          onUpdate: (n) => {
            node.textContent = `${prefix}${Math.round(n)}`;
          },
        });
      },
      { threshold: 0.6 },
    );
    node.textContent = `${prefix}0`;
    observer.observe(node);
    return () => {
      observer.disconnect();
      controls?.stop();
      node.textContent = `${prefix}${value}`;
    };
  }, [value, prefix]);

  const final = `${prefix}${value}`;
  return (
    <span className={`inline-grid tabular-nums ${className ?? ""}`}>
      <span className="sr-only">{final}</span>
      <span aria-hidden="true" className="invisible [grid-area:1/1]">
        {final}
      </span>
      <span ref={shown} aria-hidden="true" className="[grid-area:1/1]">
        {final}
      </span>
    </span>
  );
}
