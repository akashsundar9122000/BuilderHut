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
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "dl";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    return node ? holdUntilSeen(node, "0px 0px -10% 0px") : undefined;
  }, []);

  return (
    <Tag ref={ref as never} className={cn("bh-mk-stagger", className)}>
      {children}
    </Tag>
  );
}
