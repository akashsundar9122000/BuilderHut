"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Globe, PanelLeft, PanelLeftClose } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { NAV_GROUPS } from "./nav";

/*
 * Blueprint section 9's sidebar.
 *
 * Items that do not exist yet are shown and disabled rather than hidden. A
 * merchant seeing "Orders" greyed out understands the product has orders and
 * they haven't got there; a merchant seeing nothing assumes it cannot do it.
 */
export function Sidebar({
  storeName,
  storeSlug,
}: {
  storeName: string;
  storeSlug: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "bg-surface border-border hidden shrink-0 flex-col border-r transition-[width] duration-(--bh-duration-base) ease-(--ease-out) md:flex",
        collapsed ? "w-16" : "w-[248px]",
      )}
    >
      <div className="border-border flex h-14 items-center gap-2 border-b px-3">
        {!collapsed ? (
          <Link href="/app" className="font-display truncate text-base">
            {storeName}
          </Link>
        ) : null}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="text-muted hover:text-text hover:bg-raised ml-auto grid size-8 place-items-center rounded-md transition-colors"
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed ? (
              <p className="text-faint px-2 pb-2 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
                {group.label}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                const content = (
                  <>
                    <Icon className="size-4 shrink-0" />
                    {!collapsed ? (
                      <span className="truncate">{item.label}</span>
                    ) : null}
                    {!collapsed && item.soon ? (
                      <span className="text-faint ml-auto text-[0.6rem] tracking-wide uppercase">
                        Soon
                      </span>
                    ) : null}
                  </>
                );
                const className = cn(
                  "flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-(--bh-duration-fast)",
                  active
                    ? "bg-accent-soft text-accent font-medium"
                    : item.soon
                      ? "text-faint cursor-not-allowed"
                      : "text-text-secondary hover:bg-raised hover:text-text",
                );

                return (
                  <li key={item.href}>
                    {item.soon ? (
                      <span
                        className={className}
                        title="Coming in a later phase"
                        aria-disabled="true"
                      >
                        {content}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className={className}
                        title={collapsed ? item.label : undefined}
                      >
                        {content}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-border flex flex-col gap-2 border-t p-3">
          {/*
            Chrome, not a place that changes what the shop does — which is why
            this is here and not in GROUPS. A new tab, like "View my store"
            below it: somebody who opens the guide to check one thing should
            come back to the form they were half way through filling in.
          */}
          <a
            href="/guide/start/welcome"
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-accent flex items-center gap-2 text-xs transition-colors"
          >
            <BookOpen className="size-3.5" />
            Guide
          </a>
          <a
            href={`/s/${storeSlug}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-accent flex items-center gap-2 text-xs transition-colors"
          >
            <Globe className="size-3.5" />
            View my store
          </a>
        </div>
      ) : null}
    </aside>
  );
}
