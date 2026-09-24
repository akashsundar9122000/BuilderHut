"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { setRemindersAction } from "@/app/(dashboard)/app/marketing/actions";

/*
 * A switch that reports what it actually did.
 *
 * Optimistic and then corrected: the merchant sees it move immediately, and if
 * the server refuses it moves back with the reason rather than sitting in a
 * state the database does not share.
 */
export function RemindersToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <label className="border-border flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          className="accent-accent size-4"
          onChange={(event) => {
            const next = event.target.checked;
            setOn(next);
            setMessage(null);
            start(async () => {
              const result = await setRemindersAction(next);
              if (!result.ok) {
                setOn(!next);
                setMessage(result.message ?? "That didn't work.");
              }
            });
          }}
        />
        <span className="text-text flex-1 text-sm">
          {on ? "Reminders are on" : "Reminders are off"}
        </span>
        {pending ? <Loader2 className="text-muted size-4 animate-spin" /> : null}
      </label>
      {message ? (
        <p role="alert" className="text-warning text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
}
