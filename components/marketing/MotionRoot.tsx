"use client";

import { LazyMotion, MotionConfig } from "motion/react";

import { useMotion } from "@/lib/use-motion";

/*
 * The only place the marketing surface configures `motion`.
 *
 * LazyMotion with `strict`, so any component that reaches for the full
 * `motion.div` rather than the slim `m.div` throws in development instead of
 * quietly pulling the whole library back into the bundle. The features
 * themselves arrive by dynamic import: nothing `motion` does on this page is
 * needed for the first paint — every entrance is CSS — so there is no reason
 * for its animation engine to share a chunk with the page's own code.
 *
 * reducedMotion follows the site's resolved preference (lib/motion.ts), not
 * motion's own "user" mode, which reads only the OS media query and would
 * ignore the footer's motion control in both directions.
 */
const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export function MotionRoot({ children }: { children: React.ReactNode }) {
  const motion = useMotion();
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion={motion === "reduce" ? "always" : "never"}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
