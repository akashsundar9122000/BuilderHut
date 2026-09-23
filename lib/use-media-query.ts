"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A media query as React state.
 *
 * `useSyncExternalStore` rather than an effect, because the server snapshot is
 * explicit: it returns false during SSR and on the first client render, then
 * updates. An effect-based version would render the desktop tree, flash, and
 * warn about a hydration mismatch on every phone.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below Tailwind's `sm`. The width at which side panels stop being usable. */
export function useIsPhone(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
