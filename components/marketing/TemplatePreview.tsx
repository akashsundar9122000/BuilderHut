"use client";

import { useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * The chrome around a template preview: a width, and the template inside it.
 *
 * ── Why an iframe ─────────────────────────────────────────────────────────
 *
 * The first version rendered the storefront inline and narrowed a wrapper.
 * That is wrong in a way that looks right: a storefront's layout responds to
 * the VIEWPORT, so narrowing a box inside a 1440px window produces a squeezed
 * desktop page — the hero type stayed at its desktop size and ran off the
 * edge. The toggle was showing people a broken version of a template that is
 * perfectly fine on a real phone.
 *
 * An iframe has its own viewport. The media queries and vw units inside it
 * resolve against the width chosen here, so "Phone" is the phone layout rather
 * than a picture of one.
 *
 * It scrolls internally on purpose: the whole point is to look around the
 * template, and a page-height iframe would make the outer page absurd.
 */

const DEVICES = [
  { id: "desktop", label: "Desktop", width: "100%", Icon: Monitor },
  { id: "tablet", label: "Tablet", width: "48rem", Icon: Tablet },
  { id: "phone", label: "Phone", width: "24.375rem", Icon: Smartphone },
] as const;

export function TemplatePreview({ src, name }: { src: string; name: string }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const current = DEVICES.find((d) => d.id === device)!;

  return (
    <div>
      <div className="mb-5 flex justify-center">
        <div
          className="border-border bg-surface inline-flex gap-1 rounded-full border p-1"
          role="group"
          aria-label="Preview width"
        >
          {DEVICES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-pressed={device === id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors duration-(--bh-duration-fast) ease-(--ease-out)",
                device === id ? "bg-accent text-on-accent" : "text-text-secondary hover:bg-raised",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="border-border bg-surface mx-auto overflow-hidden rounded-[var(--bh-radius-xl)] border shadow-lg transition-[max-width] duration-(--bh-duration-base) ease-(--ease-out) motion-reduce:transition-none"
        style={{ maxWidth: current.width }}
      >
        <iframe
          src={src}
          title={`A preview of the ${name} template`}
          loading="lazy"
          className="block h-[clamp(30rem,78vh,52rem)] w-full"
        />
      </div>
    </div>
  );
}
