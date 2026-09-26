"use client";

import { Moon, Sun } from "lucide-react";
import { prefersReducedMotion } from "@/lib/motion";
import { useTheme, type Theme } from "@/lib/theme";
import { Button } from "./Button";

/*
 * The icon is the mode you are about to GET, not the one you are in.
 *
 * It used to show the current mode, which put the picture and the label in
 * direct contradiction: in dark mode it drew a moon while announcing "switch
 * to light mode". A control that shows its current state is a status light; a
 * control that shows its outcome is a button, and this is a button.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={(e) => switchWithReveal(e.currentTarget, () => setTheme(next as Theme))}
    >
      {next === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

/*
 * The new theme spreads out from the button as a circle, over the old one.
 *
 * The browser snapshots the page, the theme attribute flips, and the new
 * snapshot is revealed through a growing clip-path — so it is one image
 * wiping over another, not every colour on the page transitioning at its own
 * speed (which is what `transition: background-color` everywhere looks like).
 *
 * Plain View Transitions and the Web Animations API rather than `motion`:
 * this toggle is on every surface, including the dashboard and the builder,
 * and `motion` is kept to the marketing pages (tests/unit/motion.test.ts).
 * Timing comes from the same CSS tokens everything else uses.
 *
 * Falls back to an instant swap where the API is missing or the reader asked
 * for less motion. `data-theme-switching` scopes the CSS that switches off the
 * default crossfade (styles/tokens.css), so no other view transition — the
 * template morph, a route change — is affected by it.
 */
function switchWithReveal(button: HTMLElement, apply: () => void) {
  // Feature test: older Firefox and Safari do not have the API at all.
  if (!("startViewTransition" in document) || prefersReducedMotion()) {
    apply();
    return;
  }

  const root = document.documentElement;
  const box = button.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  // Far enough to cover the furthest corner from the button.
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  root.setAttribute("data-theme-switching", "");
  const transition = document.startViewTransition(apply);
  const tokens = getComputedStyle(root);

  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        {
          duration: parseFloat(tokens.getPropertyValue("--bh-duration-slow")) || 400,
          easing: tokens.getPropertyValue("--bh-ease-out").trim() || "ease-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    // Skipped (another transition started, or the tab was hidden): the theme
    // has still been applied by `apply`, so there is nothing to recover.
    .catch(() => {});
  transition.finished.finally(() => root.removeAttribute("data-theme-switching"));
}
