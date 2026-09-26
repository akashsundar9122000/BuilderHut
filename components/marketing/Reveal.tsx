"use client";

import { useEffect, useRef } from "react";

import { holdUntilSeen } from "@/components/marketing/hold-until-seen";

/*
 * Scroll-linked entrance, without React in the loop.
 *
 * The server sends this VISIBLE. It used to send `opacity-0` and wait for an
 * observer to reveal it, which put every heading above the fold — the landing
 * hero, the /templates and /pricing intros — at opacity 0 until the page had
 * hydrated. On a slow phone that is a blank first screen, and the page's
 * largest element painted late for no reason but a fade.
 *
 * Now the element is only ever hidden by holdUntilSeen, which runs after
 * hydration, only when motion is on, and only for an element that is still
 * below the fold at that moment. Something the reader can already see is never
 * taken away to be given back. The hidden state itself is CSS, scoped to
 * :root[data-motion="full"] in styles/marketing.css, so turning motion off
 * mid-visit shows anything still waiting.
 *
 * Where scroll timelines are supported the CSS drives this from view() instead
 * and the hold is dead weight. Kept because Firefox has no scroll timelines.
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

  useEffect(() => {
    const node = ref.current;
    return node ? holdUntilSeen(node) : undefined;
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? ({ "--bh-reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
