/*
 * How much motion this reader gets — one answer, on one attribute.
 *
 * The OS setting decides by default. The marketing footer's motion control can
 * override it in either direction: someone whose OS asks for less motion can opt
 * back in on this site, and someone whose OS does not can opt out of it here.
 *
 * A media query cannot express "full, unless the reader said otherwise, which
 * can be either way" without duplicating every rule behind it. So the script
 * below resolves the answer before first paint and stamps it on <html> as
 * `data-motion="full" | "reduce"`, and every piece of motion CSS keys off that.
 *
 * With no JavaScript there is no attribute, so nothing moves and nothing is
 * hidden waiting for an observer that will never run. That is the failure
 * direction this is designed for: an unanswered question means a still page,
 * never an invisible one.
 *
 * Deliberately not a "use client" module: the root layout (a server component)
 * inlines `motionScript`, and a string exported from a client module arrives
 * there as a client reference rather than a string.
 */

export type MotionPreference = "auto" | "full" | "reduce";
export type Motion = "full" | "reduce";

export const MOTION_STORAGE_KEY = "bh-motion";
export const MOTION_EVENT = "bh-motion-change";
export const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Inlined in <head>, next to the theme script. It also listens for the OS
 * setting changing mid-visit, so turning on Reduce Motion in System Settings
 * takes effect without a reload — a preference that needs a reload to apply is
 * one people conclude does not work.
 *
 * Kept in step with `resolveMotion` below; tests/unit/motion.test.ts runs this
 * exact string against a fake document to hold the two together.
 */
export const motionScript = `(function(){try{var d=document.documentElement,m=matchMedia('${REDUCE_QUERY}');var a=function(){var p=null;try{p=localStorage.getItem('${MOTION_STORAGE_KEY}')}catch(e){}d.dataset.motion=p==='full'||p==='reduce'?p:(m.matches?'reduce':'full')};a();m.addEventListener('change',function(){a();window.dispatchEvent(new Event('${MOTION_EVENT}'))})}catch(e){}})();`;

export function resolveMotion(preference: MotionPreference, osReduces: boolean): Motion {
  if (preference === "full" || preference === "reduce") return preference;
  return osReduces ? "reduce" : "full";
}

export function readPreference(): MotionPreference {
  try {
    const stored = localStorage.getItem(MOTION_STORAGE_KEY);
    if (stored === "full" || stored === "reduce") return stored;
  } catch {
    // Storage blocked: the OS setting is all we have, which is what "auto" means.
  }
  return "auto";
}

/**
 * For imperative code that is about to animate something itself — a scroll, a
 * canvas, a count. Reads the attribute the script resolved, and falls back to
 * the media query only if the script never ran (it threw, or this is an old
 * engine), so the answer is never "full" merely because nobody asked.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const resolved = document.documentElement.dataset.motion;
  if (resolved === "reduce") return true;
  if (resolved === "full") return false;
  try {
    return window.matchMedia(REDUCE_QUERY).matches;
  } catch {
    return false;
  }
}

/*
 * ── Timing for the motion that JavaScript drives ─────────────────────────
 *
 * CSS reads its timing from the tokens in styles/tokens.css. The few things
 * `motion` animates read theirs from here, and the easing below is the same
 * curve as the CSS token of the same name — tests/unit/motion.test.ts parses
 * tokens.css and fails if they drift, so a hover done in CSS and a crossfade
 * done in JS on the same element move identically rather than nearly so.
 */

/** cubic-bezier(0.22, 1, 0.36, 1) — `--bh-ease-out`. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/*
 * Every spring here is critically or over-damped BY CALCULATION:
 *   zeta = damping / (2 * sqrt(stiffness * mass))
 *   snap   32 / (2 * sqrt(420 * 0.7)) = 0.93
 *   glide  30 / (2 * sqrt(260 * 0.9)) = 0.98
 *   settle 26 / (2 * sqrt(170 * 1.0)) = 1.00
 * so none of them visibly overshoots. Overshoot is the difference between
 * "responsive" and "bouncy", and bouncy is what makes a product page feel like
 * a toy. The test recomputes zeta rather than trusting this comment.
 */
export const SPRING = {
  snap: { type: "spring", stiffness: 420, damping: 32, mass: 0.7 },
  glide: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  settle: { type: "spring", stiffness: 170, damping: 26, mass: 1 },
} as const;

/** The hero's template cycle. */
export const HERO_CYCLE = {
  /** How long each template is on screen — long enough to actually look at. */
  dwellMs: 5200,
  /** When the drawn cursor sets off for the next swatch, before the switch. */
  cursorLeadMs: 1100,
  /** The crossfade itself, in seconds as `motion` expects. */
  crossfade: 0.7,
} as const;

/** CountUp: long enough to read as counting, short enough to be done by the time you look. */
export const COUNT_UP_S = 1.4;
