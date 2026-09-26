"use client";

import { m, useMotionValue, useSpring } from "motion/react";

import { useFinePointer } from "@/components/marketing/Tilt";
import { SPRING } from "@/lib/motion";
import { useMotion } from "@/lib/use-motion";

/*
 * The primary call to action leans toward a cursor that comes near it.
 *
 * A few pixels, no more. Past that it stops being a hint that the button is
 * the thing to press and becomes a button that runs away from you, and the
 * click lands somewhere it no longer is. The spring is `snap`, so it follows
 * without lag and returns without a wobble.
 *
 * Fine pointers and full motion only; otherwise the child renders untouched.
 */
const MAX_PX = 6;

export function Magnetic({ children }: { children: React.ReactNode }) {
  const motion = useMotion();
  const fine = useFinePointer();
  const x = useSpring(useMotionValue(0), SPRING.snap);
  const y = useSpring(useMotionValue(0), SPRING.snap);

  if (motion !== "full" || !fine) return <>{children}</>;

  return (
    <m.span
      className="inline-flex"
      style={{ x, y }}
      onPointerMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const dx = (e.clientX - (box.left + box.width / 2)) / (box.width / 2);
        const dy = (e.clientY - (box.top + box.height / 2)) / (box.height / 2);
        x.set(Math.max(-1, Math.min(1, dx)) * MAX_PX);
        y.set(Math.max(-1, Math.min(1, dy)) * MAX_PX);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </m.span>
  );
}
