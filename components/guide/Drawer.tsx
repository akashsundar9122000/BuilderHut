"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { GuideNav } from "./Nav";

/*
 * The guide's contents on a phone.
 *
 * A plain disclosure rather than a sheet or a modal. components/ui has no Sheet
 * primitive, and introducing one for a single use is more surface than this
 * needs — the dashboard's own MobileNav takes the same line, designing for the
 * phone rather than narrowing the desktop.
 *
 * It closes on navigate. Without that the contents stay open over the page the
 * reader just chose, and they have to dismiss the menu to read what they asked
 * for.
 */
export function GuideDrawer({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  /*
   * Adjusted during render rather than in an effect, the same way the builder
   * opens its settings sheet. An effect would paint the new page with the
   * contents still over it and then paint it again without — and the reader
   * sees the menu they just used flicker on top of what they asked for.
   */
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className={cn("border-border border-b pb-3", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="guide-nav-mobile"
        className="border-border-input bg-surface text-text flex h-11 w-full items-center justify-between rounded-md border px-3 text-sm font-medium"
      >
        Guide contents
        <ChevronDown
          className={cn(
            "text-muted size-4 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {/*
        Rendered only when open, so the phone copy of the nav is not a second
        set of every link sitting in the accessibility tree behind the desktop
        one — and so its search box cannot be the one a test accidentally finds.
      */}
      {open ? (
        <div className="border-border bg-surface mt-2 max-h-[70dvh] overflow-y-auto rounded-md border px-3">
          <GuideNav id="guide-nav-mobile" />
        </div>
      ) : null}
    </div>
  );
}
