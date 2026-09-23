"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Only 'light' | 'dark'. There is deliberately no "system" option in the UI:
 * a third state means the toggle sometimes appears to do nothing (when the OS
 * preference already matches), and users read that as a bug. The OS preference
 * still decides the FIRST paint — see themeScript — it just stops being an
 * option once someone has expressed a choice.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "bh-theme";
const EVENT = "bh-theme-change";

/**
 * Runs before first paint, inlined in <head>. Without this the page renders in
 * light and then flips, which reads as a broken app on every dark-mode load.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;}catch(e){}})();`;

/*
 * The DOM attribute is the source of truth, not React state.
 *
 * The inline script above has already set it before React exists, so reading it
 * through useSyncExternalStore means the two can never disagree — and it avoids
 * the setState-in-an-effect pattern that costs a second render on every load.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

// There is no document during SSR. Light is the safe assumption: the inline
// script corrects it before anything is painted.
function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing, or storage disabled. The choice just won't outlive the tab.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { theme, setTheme };
}
