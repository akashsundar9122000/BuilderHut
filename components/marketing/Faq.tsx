"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { QUESTIONS } from "@/lib/marketing/content";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-2xl">
      {QUESTIONS.map((item, i) => {
        const expanded = open === i;
        return (
          <div key={item.q} className="border-border border-b">
            <button
              onClick={() => setOpen(expanded ? null : i)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-4 py-5 text-left"
            >
              <span className="text-text flex-1 text-base">{item.q}</span>
              <Plus
                className={cn(
                  "text-muted size-4 shrink-0 transition-transform duration-(--bh-duration-base) ease-(--ease-out)",
                  expanded && "rotate-45",
                )}
              />
            </button>
            {/* Grid-rows trick: animates to the content's real height without
                needing to measure it in JavaScript. */}
            <div
              className="grid transition-[grid-template-rows] duration-(--bh-duration-base) ease-(--ease-out)"
              style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="text-muted pb-5 text-sm leading-relaxed">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
