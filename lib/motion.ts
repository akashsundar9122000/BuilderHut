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
