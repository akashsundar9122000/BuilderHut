"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/*
 * Scroll-linked entrance, without an animation library.
 *
 * One IntersectionObserver per element, disconnected the moment it fires, so a
 * long page does not accumulate live observers. Transform and opacity only, so
 * it stays on the compositor.
 *
 * Reduced motion is handled in CSS rather than here: `motion-reduce:transition-none`
 * makes the same state change instant. Branching on the media query in the
 * effect instead would mean a synchronous setState on every mount, and an extra
 * render for every revealed element on the page.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      // Fire slightly before the element reaches the viewport, so the motion has
      // finished by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={cn(
        "transition-[opacity,transform] duration-(--bh-duration-deliberate) ease-(--ease-out) motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className,
      )}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

/*
 * Without JavaScript the reveal never fires and the page would be blank. This
 * is the whole marketing site, so that failure mode is not acceptable — the
 * content is there in the HTML either way, and this makes sure it is visible.
 */
export function RevealNoScript() {
  return (
    <noscript>
      <style
        dangerouslySetInnerHTML={{
          __html: "[data-reveal]{opacity:1 !important;transform:none !important}",
        }}
      />
    </noscript>
  );
}
