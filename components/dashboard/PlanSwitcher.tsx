"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui";
import { changePlanAction } from "@/app/(dashboard)/app/plan/actions";

/*
 * Moving between plans.
 *
 * A refusal is shown against the plan that refused it, not as a toast that
 * disappears: "Starter includes 15 products and you're using 40" is the whole
 * reason the button did nothing, and it needs to stay on screen while the
 * merchant goes and does something about it.
 */
export function PlanSwitcher({
  planId,
  planName,
  current,
}: {
  planId: string;
  planName: string;
  current: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (current) {
    return (
      <Button variant="secondary" size="sm" className="w-full" disabled>
        You&rsquo;re on this
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const result = await changePlanAction(planId);
            if (!result.ok) setMessage(result.message);
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        Move to {planName}
      </Button>
      {message ? (
        <p role="alert" className="text-warning text-xs leading-relaxed">
          {message}
        </p>
      ) : null}
    </div>
  );
}
