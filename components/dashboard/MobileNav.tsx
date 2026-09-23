"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, LayoutDashboard, Package, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/cn";

/*
 * The phone's navigation. The sidebar is desktop-only, and blueprint section 54
 * is explicit that mobile is designed, not narrowed — so rather than cram
 * fourteen items into a drawer, this is the four things a merchant opens their
 * phone to do. The rest live on the desktop sidebar.
 *
 * Sits above the home indicator via the safe-area token, so the last row of a
 * list is never trapped under it.
 */
const ITEMS = [
  { href: "/app", label: "Home", icon: LayoutDashboard },
  { href: "/app/products", label: "Products", icon: Package },
  { href: "/app/orders", label: "Orders", icon: ShoppingBag, soon: true },
];

export function MobileNav({ storeSlug }: { storeSlug: string }) {
  const pathname = usePathname();

  return (
    <nav
      className="bg-surface border-border fixed inset-x-0 bottom-0 z-30 flex border-t md:hidden"
      style={{ paddingBottom: "var(--bh-safe-bottom)" }}
    >
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        const content = (
          <>
            <Icon className="size-5" />
            <span className="text-[0.65rem]">{item.label}</span>
          </>
        );
        const className = cn(
          // 56px clears the 44px touch floor with room for the label.
          "flex h-14 flex-1 flex-col items-center justify-center gap-1 transition-colors",
          active ? "text-accent" : item.soon ? "text-faint" : "text-muted",
        );
        return item.soon ? (
          <span key={item.href} className={className} aria-disabled="true">
            {content}
          </span>
        ) : (
          <Link key={item.href} href={item.href} className={className}>
            {content}
          </Link>
        );
      })}
      <a
        href={`/s/${storeSlug}`}
        target="_blank"
        rel="noreferrer"
        className="text-muted flex h-14 flex-1 flex-col items-center justify-center gap-1"
      >
        <Globe className="size-5" />
        <span className="text-[0.65rem]">Store</span>
      </a>
    </nav>
  );
}
