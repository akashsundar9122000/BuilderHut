"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

const QUESTIONS = [
  {
    q: "Do I need to know how to build a website?",
    a: "No. You pick a starting point that suits what you make, then change the words, the colours and the pictures by clicking on them. If you can use Instagram, you can use this.",
  },
  {
    q: "What does it cost?",
    a: "Nothing to build, and nothing to keep a store at its BuilderHut address. Paid plans arrive when there is something worth paying for — a custom domain, staff accounts, deeper analytics. You will not find a bill you did not agree to.",
  },
  {
    q: "Can I use my own domain name?",
    a: "That is coming. Every store gets a free BuilderHut address now, and it keeps working after you connect a domain — old links will not break.",
  },
  {
    q: "How do I take payment?",
    a: "Card payments through a real gateway are being built. Today you can list what you make, take enquiries over WhatsApp, and test the whole checkout with a simulated payment so nothing surprises you when it goes live.",
  },
  {
    q: "Will my store look like everybody else's?",
    a: "That is the thing we are most careful about. A bakery, a jeweller and a streetwear label start from genuinely different designs — different typefaces, different spacing, different shapes — not the same page in three colours.",
  },
  {
    q: "What happens to my products if I stop paying?",
    a: "Your data stays yours. Exports are part of the plan from the beginning, and nothing you have made gets held hostage.",
  },
];

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
