"use client";

import { m, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { useMotion } from "@/lib/use-motion";

/*
 * A card that leans a few degrees toward the pointer, and settles back when
 * it leaves. Bookie's `Tilt`, on a spring rather than a rAF loop.
 *
 * Fine pointers only. On a touch screen there is no hover to follow, and a
 * card that tips when a thumb lands on it to scroll reads as the page
 * wobbling. Under reduced motion it renders a plain div — nothing listens,
 * nothing is measured.
 *
 * The lean goes through `transform` on its own wrapper, so it never collides
 * with the `translate` a Stagger entrance puts on the same card.
 */
const MAX_DEG = 5;

function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const list = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return fine;
}

export function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const motion = useMotion();
  const fine = useFinePointer();
  const rx = useSpring(useMotionValue(0), SPRING.settle);
  const ry = useSpring(useMotionValue(0), SPRING.settle);

  if (motion !== "full" || !fine) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={cn("[transform-style:preserve-3d]", className)}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1100 }}
      onPointerMove={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - box.left) / box.width - 0.5;
        const py = (e.clientY - box.top) / box.height - 0.5;
        ry.set(px * MAX_DEG * 2);
        rx.set(-py * MAX_DEG * 2);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </m.div>
  );
}

export { useFinePointer };
