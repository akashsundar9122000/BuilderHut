"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

import { PanelSheet } from "@/components/ui/PanelSheet";
import { cn } from "@/lib/cn";

/*
 * A phone's navigation: a few things at the bottom, the rest behind More.
 *
 * Shared by the merchant dashboard and the operator console because both had
 * the same problem in different shapes. The console put eight sections in a
 * horizontal scroll strip under the header, where five were off-screen with
 * nothing to say so. The dashboard put four of fifteen at the bottom and
 * simply omitted the other eleven — Customers, Analytics, Settings and the
 * whole Configure group were unreachable on a phone. Both are the desktop
 * sidebar losing an argument with a narrow screen, which blueprint section 54
 * is explicit about not doing.
 *
 * Three or four primary slots, because a thumb can reach the bottom of a
 * phone and cannot reach the top, and because a fifth tab makes every tab too
 * narrow to label. Everything else lives in a sheet — the same PanelSheet the
 * builder uses for its panels, so the gesture is the one the product already
 * teaches, and it keeps its focus trap and Escape handling for free.
 */

export interface TabItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Opens in a new tab rather than navigating — the storefront link. */
  external?: boolean;
}

export interface TabGroup {
  label: string;
  items: TabItem[];
}

export function MobileTabBar({
  primary,
  groups,
  ariaLabel = "Sections",
}: {
  primary: TabItem[];
  /** Everything behind More, kept in the sidebar's own groups so the two read alike. */
  groups: TabGroup[];
  ariaLabel?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /*
   * Exact for a root like /app, prefix for everything under it. Without the
   * special case, /app matches every page in the product and all the tabs
   * light up at once.
   */
  const isActive = (href: string) =>
    href === "/app" || href === "/admin" ? pathname === href : pathname.startsWith(href);

  const overflowActive = groups.some((g) =>
    g.items.some((i) => !i.external && isActive(i.href)),
  );

  return (
    <>
      <nav
        aria-label={ariaLabel}
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
            // Lit when the page you are on lives behind it, so More never looks
            // inactive while you are standing inside it.
            overflowActive ? "text-accent" : "text-muted",
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          <span className="text-[0.65rem]">More</span>
        </button>
      </nav>

      <PanelSheet open={open} title="Everything else" onClose={() => setOpen(false)}>
        <div className="p-2 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="text-faint px-3 py-1.5 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
                {group.label}
              </p>
              <ul className="flex flex-col">
                {group.items.map((item) => {
                  const active = !item.external && isActive(item.href);
                  const Icon = item.icon;
                  const className = cn(
                    "flex h-12 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active ? "bg-raised text-accent" : "text-text-secondary hover:bg-raised",
                  );
                  return (
                    <li key={item.href}>
                      {item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setOpen(false)}
                          className={className}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          // The sheet must not survive the navigation it caused.
                          onClick={() => setOpen(false)}
                          aria-current={active ? "page" : undefined}
                          className={className}
                        >
                          <Icon className="size-4 shrink-0" aria-hidden="true" />
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </PanelSheet>
    </>
  );
}
