"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  MOTION_EVENT,
  MOTION_STORAGE_KEY,
  REDUCE_QUERY,
  readPreference,
  resolveMotion,
  type Motion,
  type MotionPreference,
} from "@/lib/motion";

/*
 * The DOM attribute is the source of truth, exactly as with the theme (see
 * lib/theme.tsx): the inline script set it before React existed, so reading it
 * through useSyncExternalStore means React and CSS cannot disagree about
 * whether things move.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(MOTION_EVENT, onChange);
  return () => window.removeEventListener(MOTION_EVENT, onChange);
}

/*
 * "reduce" on the server and during hydration. The cost of guessing wrong this
 * way is that a loop mounts one frame late; the cost of guessing "full" is a
 * loop that starts for someone who asked it not to, however briefly.
 */
const serverMotion = (): Motion => "reduce";

export function useMotion(): Motion {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.motion === "full" ? "full" : "reduce"),
    serverMotion,
  );
}

export function useMotionPreference() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "auto" as const);

  const setPreference = useCallback((next: MotionPreference) => {
    try {
      if (next === "auto") localStorage.removeItem(MOTION_STORAGE_KEY);
      else localStorage.setItem(MOTION_STORAGE_KEY, next);
    } catch {
      // Private browsing, or storage disabled. The choice holds for this page only.
    }
    document.documentElement.dataset.motion = resolveMotion(
      next,
      window.matchMedia(REDUCE_QUERY).matches,
    );
    window.dispatchEvent(new Event(MOTION_EVENT));
  }, []);

  return { preference, setPreference };
}
