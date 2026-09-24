"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/*
 * A group of things that arrive one after another.
 *
 * One IntersectionObserver on the container, and the delays live in CSS
 * (styles/marketing.css). Deliberately not a Reveal per child: six cards in a
 * row cross the threshold in the same frame, so six observers would all fire
 * together and the stagger would not exist — it would just be a fade with
 * extra objects. The delay has to come from position in the list, and CSS
 * already knows that.
 *
 * The observer writes an attribute rather than setting state, so revealing a
 * twelve-item grid costs no React render at all.
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        node.setAttribute("data-shown", "");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref as never} className={cn("bh-mk-stagger", className)}>
      {children}
    </Tag>
  );
}

/*
 * Same reasoning as RevealNoScript: without JavaScript the observer never runs
 * and a staggered grid would be a blank space. The content is in the HTML
 * either way.
 */
export function StaggerNoScript() {
  return (
    <noscript>
      <style
        dangerouslySetInnerHTML={{
          __html:
            ".bh-mk-stagger > *{opacity:1 !important;translate:none !important}",
        }}
      />
    </noscript>
  );
}
