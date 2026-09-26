"use client";

import { cn } from "@/lib/cn";
import type { MotionPreference } from "@/lib/motion";
import { useMotionPreference } from "@/lib/use-motion";

/*
 * Auto, On or Reduced — the reader's say over how much this site moves.
 *
 * Three states rather than the theme toggle's two (see lib/theme.tsx for why
 * that one refuses a third). The difference is that "follow my system" is a
 * real answer here, and the one most people want: the OS setting is
 * frequently an accessibility need, and a site that forgets it the moment
 * you touch a control is worse than one that never offered the control.
 *
 * Native radios, visually restyled, so arrow keys, focus and the announced
 * "1 of 3" all come from the platform rather than from code.
 */
const OPTIONS: { value: MotionPreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "full", label: "On" },
  { value: "reduce", label: "Reduced" },
];

export function MotionToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useMotionPreference();

  return (
    <fieldset className={cn("flex flex-col gap-2.5", className)}>
      <legend className="text-faint mb-2.5 text-xs tracking-[0.14em] uppercase">Motion</legend>
      <div className="border-border bg-surface inline-flex w-fit rounded-full border p-0.5">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "coarse:min-h-11 flex min-h-8 cursor-pointer items-center rounded-full px-3 text-xs",
              "transition-colors duration-(--bh-duration-fast) ease-(--ease-out)",
              "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              preference === option.value
                ? "bg-text text-canvas"
                : "text-muted hover:text-text",
            )}
          >
            <input
              type="radio"
              name="bh-motion"
              value={option.value}
              checked={preference === option.value}
              onChange={() => setPreference(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
