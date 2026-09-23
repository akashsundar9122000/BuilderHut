"use client";

import { useState } from "react";
import { StoreFrame } from "./StoreFrame";
import { cn } from "@/lib/cn";
import type { TemplateSummary } from "@/lib/templates";

/*
 * The argument the landing page has to make: these are not one layout in six
 * palettes. Switching tabs swaps the type pairing, the corner radius, the
 * spacing and the whole colour system at once, live — which is more convincing
 * than any sentence claiming it.
 */
export function TemplateCarousel({ templates }: { templates: TemplateSummary[] }) {
  const [active, setActive] = useState(templates[0]!.id);
  const current = templates.find((t) => t.id === active) ?? templates[0]!;

  return (
    <div>
      <div
        className="scrollbar-none -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        role="tablist"
        aria-label="Templates"
      >
        {templates.map((template) => (
          <button
            key={template.id}
            role="tab"
            aria-selected={template.id === active}
            onClick={() => setActive(template.id)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm transition-all duration-(--bh-duration-fast) ease-(--ease-out)",
              template.id === active
                ? "border-accent bg-accent text-on-accent"
                : "border-border text-text-secondary hover:border-border-strong hover:bg-raised",
            )}
          >
            {template.name}
          </button>
        ))}
      </div>

      <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Keyed so the frame remounts and the transition reads as a swap. */}
        <StoreFrame key={current.id} template={current} className="shadow-lg" />

        <div className="lg:pt-6">
          <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
            {current.name}
          </p>
          <p className="font-display mt-3 text-2xl leading-snug">{current.blurb}</p>

          <dl className="mt-6 flex flex-col gap-3 text-sm">
            <div className="border-border flex gap-4 border-b pb-3">
              <dt className="text-muted w-28 shrink-0">Built for</dt>
              <dd className="text-text">
                {current.industries
                  .filter((i) => i !== "other")
                  .slice(0, 3)
                  .join(", ")}
              </dd>
            </div>
            <div className="border-border flex gap-4 border-b pb-3">
              <dt className="text-muted w-28 shrink-0">Type</dt>
              <dd className="text-text capitalize">
                {current.theme.typography.heading} &amp; {current.theme.typography.body}
              </dd>
            </div>
            <div className="border-border flex gap-4 border-b pb-3">
              <dt className="text-muted w-28 shrink-0">Corners</dt>
              <dd className="text-text">
                {current.theme.shape.radius === 0 ? "Sharp" : `${current.theme.shape.radius}px`}
              </dd>
            </div>
            <div className="flex gap-4">
              <dt className="text-muted w-28 shrink-0">Palette</dt>
              <dd className="flex gap-1.5">
                {current.swatches.map((swatch) => (
                  <span
                    key={swatch}
                    className="border-border size-5 rounded-full border"
                    style={{ background: swatch }}
                    title={swatch}
                  />
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
