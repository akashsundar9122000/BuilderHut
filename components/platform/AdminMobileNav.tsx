"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { ADMIN_OVERFLOW, ADMIN_PRIMARY } from "@/components/platform/admin-nav";
import { PanelSheet } from "@/components/ui/PanelSheet";
import { cn } from "@/lib/cn";

/*
 * The operator console's navigation, on a phone.
 *
 * It used to be the eight sidebar items in a horizontal scroll strip under the
 * header. That is the classic way to get a phone layout wrong: five of the
 * eight are off-screen with nothing to say so, the ones you can see sit in the
 * hardest part of the screen to reach, and scrolling a nav sideways competes
 * with scrolling the page down. It is the desktop sidebar turned on its side,
 * which blueprint section 54 is explicit about not doing.
 *
 * So: the three an operator actually opens, at the bottom where a thumb is,
 * and everything else behind More in a sheet — the same PanelSheet the builder
 * uses for its panels, so the gesture is the one already learned elsewhere in
 * the product.
 *
 * Which three, and why, is recorded next to the list in admin-nav.ts.
 */

export function AdminMobileNav() {
  const primary = ADMIN_PRIMARY;
  const overflow = ADMIN_OVERFLOW;

  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /*
   * `/admin` would otherwise be "active" on every page under it, so all three
   * tabs light up at once. Exact for the root, prefix for the rest.
   */
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const overflowActive = overflow.some((item) => isActive(item.href));

  return (
    <>
      <nav
        aria-label="Sections"
        className="bg-surface border-border fixed inset-x-0 bottom-0 z-30 flex border-t md:hidden"
        style={{ paddingBottom: "var(--bh-safe-bottom)" }}
      >
        {primary.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // 56px clears the 44px touch floor with room for the label.
              className={cn(
                "flex h-14 flex-1 flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-accent" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="text-[0.65rem]">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className={cn(
            "flex h-14 flex-1 flex-col items-center justify-center gap-1 transition-colors",
            // Lit when the page you are on lives behind it, so "More" never
            // looks inactive while you are standing inside it.
            overflowActive ? "text-accent" : "text-muted",
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          <span className="text-[0.65rem]">More</span>
        </button>
      </nav>

      <PanelSheet open={open} title="All sections" onClose={() => setOpen(false)}>
        <ul className="flex flex-col p-2">
          {overflow.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  // The sheet must not survive the navigation it caused.
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active ? "bg-raised text-accent" : "text-text-secondary hover:bg-raised",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </PanelSheet>
    </>
  );
}
