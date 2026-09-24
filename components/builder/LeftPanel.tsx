"use client";

import { useState } from "react";
import { Eye, EyeOff, FileText, GripVertical, Layers, Lock, Plus, Sparkles } from "lucide-react";

import { cn } from "@/lib/cn";
import { insertableRange, newSectionId } from "@/lib/builder/commands";
import { useBuilder } from "@/lib/builder/store";
import { AssistPanel } from "./AssistPanel";
import { REGISTRY } from "@/lib/render/registry";
import type { SectionType } from "@/lib/schema/page";

/*
 * The left rail: add sections, see the page's structure, switch pages.
 *
 * Three tabs rather than three panels, because the canvas is the product and
 * anything that narrows it needs to earn the space.
 */

type Tab = "add" | "layers" | "pages" | "assist";

const GROUP_LABELS: Record<string, string> = {
  content: "Content",
  commerce: "Products",
  engage: "Trust & contact",
  account: "Customer account",
  structure: "Structure",
};

/*
 * The order the Add panel shows its groups in. "account" is last because it only
 * ever appears on three of a shop's pages — and a group with nothing addable in it
 * renders nothing at all, so no merchant standing anywhere else sees a new
 * heading.
 */
const GROUP_ORDER = ["content", "commerce", "engage", "account"] as const;

export function LeftPanel() {
  const [tab, setTab] = useState<Tab>("add");

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex border-b" role="tablist">
        {(
          [
            ["add", "Add", Plus],
            ["layers", "Layers", Layers],
            ["pages", "Pages", FileText],
            ["assist", "Assist", Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 py-2.5 text-[0.6875rem] font-medium transition-colors",
              tab === id
                ? "text-accent border-accent border-b-2"
                : "text-muted hover:text-text border-b-2 border-transparent",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "add" && <AddPanel />}
        {tab === "layers" && <LayerTree />}
        {tab === "pages" && <PageList />}
        {tab === "assist" && <AssistPanel />}
      </div>
    </div>
  );
}

function AddPanel() {
  const { page, run, select, selectedId } = useBuilder();
  const { min, max } = insertableRange(page);

  /*
   * A new section lands immediately below whatever is selected.
   *
   * It used to go to the end of the page every time, which is defensible until
   * you watch someone use it: they are looking at the middle of a long page,
   * they add a product grid, and the thing they just added is three screens
   * below the fold. The inspector fills with its settings, they type a
   * heading, and nothing they can see changes — so the editor looks broken
   * when it is working exactly as told.
   *
   * With nothing selected there is no "here", so the end of the page is still
   * the right answer. The clamp keeps a new section inside the editable range
   * whatever is selected: adding while the header is selected puts it at the
   * top of the page rather than above the header.
   */
  const selectedIndex = page.sections.findIndex((s) => s.id === selectedId);
  const index =
    selectedIndex === -1 ? max : Math.min(Math.max(selectedIndex + 1, min), max);

  // Structural sections cannot be added: a page has exactly one header and one
  // footer, and they arrive with the template.
  const addable = (Object.entries(REGISTRY) as [SectionType, (typeof REGISTRY)[SectionType]][])
    .filter(
      ([type, entry]) =>
        entry.group !== "structure" &&
        // A sign-in form is offered on the sign-in page and nowhere else…
        (entry.onlyOn === undefined || entry.onlyOn === page.system) &&
        // …and never a second time on the page that already has one.
        !(entry.essential && page.sections.some((section) => section.type === type)),
    );

  return (
    <div className="p-3">
      {GROUP_ORDER.map((group) => {
        const entries = addable.filter(([, entry]) => entry.group === group);
        if (entries.length === 0) return null;
        return (
          <div key={group} className="mb-5">
            <p className="text-faint mb-2 px-1 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
              {GROUP_LABELS[group]}
            </p>
            <div className="flex flex-col gap-1">
              {entries.map(([type, entry]) => (
                <button
                  key={type}
                  onClick={() => {
                    /*
                     * The new section is selected, so its settings are right
                     * there rather than needing to be hunted for on the
                     * canvas, and the canvas scrolls to meet it. On a phone
                     * that is what swaps the sheet from the section list to
                     * the settings for what was just added; before this,
                     * adding a section left the list sitting over the canvas
                     * with nothing to show for it.
                     */
                    const sectionId = newSectionId(type, page.sections);
                    run({ type: "addSection", pageId: page.id, index, sectionType: type, sectionId });
                    select(sectionId);
                  }}
                  className="border-border hover:border-accent hover:bg-accent-soft group rounded-md border px-3 py-2.5 text-left transition-all duration-(--bh-duration-fast)"
                >
                  <span className="text-text block text-sm font-medium">{entry.label}</span>
                  <span className="text-muted block text-xs leading-snug">{entry.hint}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LayerTree() {
  const { page, selectedId, select, run } = useBuilder();

  return (
    <ul className="p-2">
      {page.sections.map((section) => {
        const entry = REGISTRY[section.type];
        const fixed = entry.fixed !== undefined;
        /*
         * Fixed or essential: both resist hiding. An essential section still
         * shows a grip, because it CAN be moved — putting a hero above the
         * sign-in form is the whole point of the page being editable.
         */
        const guarded = fixed || entry.essential === true;
        return (
          <li key={section.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                selectedId === section.id
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:bg-raised",
              )}
            >
              <button onClick={() => select(section.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {fixed ? (
                  <Lock className="text-faint size-3 shrink-0" />
                ) : (
                  <GripVertical className="text-faint size-3 shrink-0" />
                )}
                <span className={cn("truncate", !section.visible && "line-through opacity-60")}>
                  {entry.label}
                </span>
              </button>
              {!guarded ? (
                <button
                  onClick={() =>
                    run({ type: "toggleSectionVisible", pageId: page.id, sectionId: section.id })
                  }
                  aria-label={section.visible ? "Hide" : "Show"}
                  className="text-muted hover:text-text shrink-0 transition-colors"
                >
                  {section.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PageList() {
  const { doc, pageId, setPage } = useBuilder();

  return (
    <div className="p-2">
      <ul className="flex flex-col gap-0.5">
        {doc.pages.map((page) => (
          <li key={page.id}>
            <button
              onClick={() => setPage(page.id)}
              /*
               * Named as well as labelled: the visible text is the page title,
               * which on its own is ambiguous against the canvas (a section
               * toolbar says "Move Sign in form" a few pixels away). Contains the
               * visible text, so it still satisfies label-in-name.
               */
              aria-label={`Open ${page.title}`}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                pageId === page.id
                  ? "bg-accent-soft text-accent"
                  : "text-text-secondary hover:bg-raised",
              )}
            >
              <FileText className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{page.title}</span>
              {page.system ? (
                <span className="text-faint shrink-0 text-[0.6rem] tracking-wide uppercase">
                  System
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-faint mt-4 px-2 text-xs leading-relaxed">
        Creating and renaming pages arrives with the page manager. System pages can never
        be deleted — your checkout, your sign-in page and your customers&rsquo; account
        page have to exist.
      </p>
    </div>
  );
}
