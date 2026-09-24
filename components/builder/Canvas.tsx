"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Eye, EyeOff, GripVertical, Lock, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { insertableRange } from "@/lib/builder/commands";
import { useBuilder, type Device } from "@/lib/builder/store";
import { STOREFRONT_FONT_VARS } from "@/lib/render/fonts";
import { REGISTRY } from "@/lib/render/registry";
import { RenderSection } from "@/lib/render/render";
import { themeToCss } from "@/lib/render/theme-css";
import type { ProductCard } from "@/lib/render/context";
import type { Section } from "@/lib/schema/page";

/*
 * The canvas.
 *
 * It renders the real storefront components from the real document — the same
 * registry the live site uses — with editing affordances layered on top rather
 * than baked in. That is what makes this WYSIWYG rather than an approximation:
 * there is no second implementation of a hero to drift away from the first.
 *
 * Device preview is width, not emulation. The storefront is responsive, so
 * constraining the canvas to 390px shows exactly what a phone shows.
 */

const DEVICE_WIDTH: Record<Device, number | null> = {
  desktop: null,
  tablet: 834,
  mobile: 390,
};

export function Canvas({ products }: { products: ProductCard[] }) {
  const { doc, page, selectedId, select, run, device } = useBuilder();
  const [dragging, setDragging] = useState<Section | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /*
   * The canvas follows the selection.
   *
   * Not every selection comes from the canvas. Adding a section from the left
   * panel selects it, and so does clicking a row in the layer tree — and both
   * of those can be a long way outside the visible band. Without this the
   * inspector filled with a section's settings while the canvas stayed where
   * it was, so typing a heading appeared to change nothing at all. It was
   * changing something; it was three screens down.
   *
   * `block: "nearest"` scrolls the least it can, which makes this a no-op for
   * a section clicked on the canvas — it is already in view. A section taller
   * than the viewport is aligned to its top instead, because the nearest edge
   * of a full-height hero is its bottom, and landing there shows the seam
   * below it rather than the thing just selected.
   */
  useEffect(() => {
    const view = scroller.current;
    if (!selectedId || !view) return;

    const node = Array.from(view.querySelectorAll("[data-section-id]")).find(
      (el) => el.getAttribute("data-section-id") === selectedId,
    );
    if (!node) return;

    const box = node.getBoundingClientRect();
    const frame = view.getBoundingClientRect();
    if (box.top >= frame.top && box.bottom <= frame.bottom) return;

    node.scrollIntoView({
      // Someone who has asked for less motion is asking not to be thrown
      // across a document they are trying to read.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: box.height > frame.height ? "start" : "nearest",
    });
  }, [selectedId]);

  const sensors = useSensors(
    // A small distance before a drag starts, so clicking to select a section
    // does not accidentally nudge it.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { min, max } = insertableRange(page);
  const movable = page.sections.slice(min, max);

  function onDragStart(event: DragStartEvent) {
    const section = page.sections.find((s) => s.id === event.active.id);
    setDragging(section ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = page.sections.findIndex((s) => s.id === active.id);
    const to = page.sections.findIndex((s) => s.id === over.id);
    if (from === -1 || to === -1) return;
    run({ type: "moveSection", pageId: page.id, from, to });
  }

  const width = DEVICE_WIDTH[device];

  return (
    <div
      ref={scroller}
      className="bg-sunken flex-1 overflow-y-auto p-4 sm:p-6"
      onClick={() => select(null)}
    >
      <div
        className="mx-auto transition-[max-width] duration-(--bh-duration-base) ease-(--ease-out)"
        style={{ maxWidth: width ? `${width}px` : "1280px" }}
      >
        <div
          data-storefront=""
          /*
           * The storefront font variables have to be here too, or the theme
           * editor's font picker changes the document and nothing on screen:
           * with no --font-archivo to resolve, the whole custom property is
           * invalid and the text keeps its inherited face.
           */
          className={`bg-surface overflow-hidden rounded-lg shadow-md ${STOREFRONT_FONT_VARS}`}
          // The merchant's theme, scoped. BuilderHut's own tokens do not reach in.
          style={{ colorScheme: "light" }}
          onClick={(e) => e.stopPropagation()}
        >
          <style dangerouslySetInnerHTML={{ __html: themeToCss(doc.theme) }} />

          {/* Locked structural sections render without drag affordances. */}
          {page.sections.slice(0, min).map((section) => (
            <SectionShell key={section.id} section={section} products={products} fixed />
          ))}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragging(null)}
          >
            <SortableContext
              items={movable.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {movable.map((section) => (
                <SortableSection key={section.id} section={section} products={products} />
              ))}
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
              {dragging ? (
                <div className="border-accent bg-accent-soft text-accent flex items-center gap-2 rounded-md border-2 px-4 py-3 text-sm font-medium shadow-lg">
                  <GripVertical className="size-4" />
                  {REGISTRY[dragging.type].label}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {page.sections.slice(max).map((section) => (
            <SectionShell key={section.id} section={section} products={products} fixed />
          ))}
        </div>

        {selectedId === null ? (
          <p className="text-muted mt-4 text-center text-xs">
            Click any section to edit it. Drag the handle to move it.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SortableSection({ section, products }: { section: Section; products: ProductCard[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: section.locked,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "opacity-40")}
    >
      <SectionShell
        section={section}
        products={products}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function SectionShell({
  section,
  products,
  fixed = false,
  handleProps,
}: {
  section: Section;
  products: ProductCard[];
  fixed?: boolean;
  handleProps?: Record<string, unknown>;
}) {
  const { doc, page, selectedId, select, run } = useBuilder();
  const selected = selectedId === section.id;
  const entry = REGISTRY[section.type];

  return (
    <div
      data-section-id={section.id}
      className="group relative"
      onClick={(event) => {
        event.stopPropagation();
        select(section.id);
      }}
    >
      {/*
       * The selection outline is an overlay rather than a border on the section
       * itself: a border would change the layout, so selecting something would
       * move it, which is disorienting in a tool that is otherwise WYSIWYG.
       */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 z-10 rounded-sm ring-inset transition-[box-shadow] duration-(--bh-duration-fast)",
          selected
            ? "ring-accent ring-2"
            : "ring-accent/0 group-hover:ring-accent/40 ring-2",
        )}
      />

      {/* Floating controls, only for the section under the cursor or selected. */}
      <div
        className={cn(
          "absolute top-2 left-2 z-20 flex items-center gap-0.5 rounded-md border shadow-sm transition-opacity duration-(--bh-duration-fast)",
          "border-border bg-surface",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {!fixed && !section.locked ? (
          <button
            {...handleProps}
            aria-label={`Move ${entry.label}`}
            className="text-muted hover:text-text hover:bg-raised grid size-7 cursor-grab place-items-center rounded-l-md active:cursor-grabbing"
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}

        <span className="text-text-secondary px-2 text-xs font-medium whitespace-nowrap">
          {entry.label}
        </span>

        {section.locked ? (
          <span className="text-faint grid size-7 place-items-center" title="Locked">
            <Lock className="size-3.5" />
          </span>
        ) : null}

        {!fixed ? (
          <>
            <IconAction
              label={section.visible ? "Hide section" : "Show section"}
              onClick={() =>
                run({ type: "toggleSectionVisible", pageId: page.id, sectionId: section.id })
              }
            >
              {section.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </IconAction>
            <IconAction
              label="Duplicate section"
              onClick={() =>
                run({ type: "duplicateSection", pageId: page.id, sectionId: section.id })
              }
            >
              <Copy className="size-3.5" />
            </IconAction>
            <IconAction
              label="Delete section"
              danger
              onClick={() =>
                run({ type: "removeSection", pageId: page.id, sectionId: section.id })
              }
            >
              <Trash2 className="size-3.5" />
            </IconAction>
          </>
        ) : null}
      </div>

      {/* A hidden section stays visible in the editor, faded, so it can be found again. */}
      <div className={cn(!section.visible && "opacity-35 grayscale")}>
        <RenderSection
          section={section}
          ctx={{ doc, base: "", products, editing: true }}
        />
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-7 place-items-center transition-colors last:rounded-r-md",
        danger ? "text-muted hover:text-danger hover:bg-danger-soft" : "text-muted hover:text-text hover:bg-raised",
      )}
    >
      {children}
    </button>
  );
}
