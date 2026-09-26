"use client";

import { useEffect, useRef } from "react";

import { holdUntilSeen } from "@/components/marketing/hold-until-seen";
import { cn } from "@/lib/cn";

/*
 * A group of things that arrive one after another.
 *
 * One observer on the container, and the delays live in CSS
 * (styles/marketing.css). Deliberately not a Reveal per child: six cards in a
 * row cross the threshold in the same frame, so six observers would all fire
 * together and the stagger would not exist — it would just be a fade with
 * extra objects. The delay has to come from position in the list, and CSS
 * already knows that.
 *
 * Visible as the server sent it unless holdUntilSeen decides otherwise; see
 * Reveal for why that matters.
 *
 * Where scroll timelines are supported this is dead weight: marketing.css
 * animates the same children off `view()` and the animation outranks the
 * transition. Kept because Firefox does not support them yet, and a section
 * that never appears is worse than a redundant observer.
 */
export function Stagger({
  children,
  className,
  as: Tag = "div",
  spotlight,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "dl";
  /**
   * A soft light that follows the pointer across whichever card it is over.
   * One listener on the grid rather than one per card, and it writes the
   * position straight to the card's style — no React render per mouse move.
   * The light itself is `.bh-mk-spotlight` in styles/marketing.css, scoped
   * to full motion and to devices that can hover.
   */
  spotlight?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    return node ? holdUntilSeen(node, "0px 0px -10% 0px") : undefined;
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node || !spotlight) return;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const card = (e.target as Element).closest<HTMLElement>(".bh-mk-stagger > *");
      if (!card || card.parentElement !== node) return;
      const box = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - box.left}px`);
      card.style.setProperty("--my", `${e.clientY - box.top}px`);
    };
    node.addEventListener("pointermove", move, { passive: true });
    return () => node.removeEventListener("pointermove", move);
  }, [spotlight]);

  return (
    <Tag
      ref={ref as never}
      className={cn("bh-mk-stagger", spotlight && "bh-mk-spotlight", className)}
    >
      {children}
    </Tag>
  );
}
