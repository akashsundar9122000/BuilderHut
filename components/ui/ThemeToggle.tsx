"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
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
      onClick={() => setTheme(next)}
    >
      {next === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
