"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/*
 * A panel as a bottom sheet, for phones.
 *
 * Blueprint section 54: a phone needs its own pattern, not a narrowed desktop
 * one. Two 180px columns side by side is not a layout, it is the desktop
 * layout losing. So on a phone the content keeps the whole screen and a panel
 * comes up over it, one at a time, when asked for.
 *
 * Lives in components/ui rather than components/builder because it is a
 * primitive with no builder in it — the operator console's "More" menu uses
 * the same sheet, and a platform screen reaching into the builder's folder to
 * borrow it would be the wrong shape twice over: misleading to read, and one
 * careless import away from pulling builder code onto a page that must never
 * carry it.
 *
 * The sheet takes focus when it opens and returns it when it closes, traps Tab
 * while it is up, and closes on Escape — everything a dialog owes a keyboard
 * or screen-reader user.
 */
export function PanelSheet({
  open,
  title,
  showTitle = true,
  onClose,
  children,
}: {
  open: boolean;
  /** Always the sheet's accessible name; shown in the header unless a panel has its own. */
  title: string;
  showTitle?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      returnFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="bg-overlay absolute inset-0"
        style={{ animation: "bh-fade 160ms var(--bh-ease-out)" }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="border-border bg-surface relative flex max-h-[78dvh] flex-col rounded-t-2xl border-t shadow-lg outline-none"
        style={{ animation: "bh-sheet-up 220ms var(--bh-ease-out)" }}
      >
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
          {/* The grab handle is decorative; the button beside it is the control. */}
          <span aria-hidden className="bg-border absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full" />
          {showTitle ? <h2 className="text-text text-sm font-semibold">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="text-muted hover:text-text -mr-1 p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
