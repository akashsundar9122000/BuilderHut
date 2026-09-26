import { prefersReducedMotion } from "@/lib/motion";

/*
 * The one decision Reveal and Stagger share: whether to hide something now so
 * that it can arrive later.
 *
 * It marks the node `data-pending` and removes the mark when the node scrolls
 * into view. The attribute is one React never rendered, so a re-render cannot
 * put it back or strip it early, and revealing a twelve-card grid costs no
 * React render at all.
 *
 * Returns the cleanup, or undefined when there was nothing to hold.
 */
export function holdUntilSeen(node: HTMLElement, rootMargin = "0px 0px -12% 0px") {
  if (prefersReducedMotion() || typeof IntersectionObserver !== "function") return;

  // Already on screen, or nearly: leave it alone. Hiding it now would make
  // something the reader is looking at blink out and fade back in.
  if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;

  node.setAttribute("data-pending", "");
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      node.removeAttribute("data-pending");
      observer.disconnect();
    },
    { rootMargin, threshold: 0.05 },
  );
  observer.observe(node);

  return () => {
    observer.disconnect();
    // Never leave a node hidden behind a disconnected observer — Strict Mode
    // runs this cleanup and the effect again, and a route change can too.
    node.removeAttribute("data-pending");
  };
}
