import Link from "next/link";
import {
  BarChart3, Building2, FileClock, Globe, LayoutDashboard, Receipt, Shield, Users,
} from "lucide-react";

import { ThemeToggle } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/platform/guard";

/*
 * The operator's console.
 *
 * Denser than the merchant dashboard — blueprint section 0.1 allows that, since
 * this is an internal operations product — but built from the same tokens and
 * the same components. A second design language for the same company is how
 * internal tools end up feeling unmaintained.
 *
 * The amber strip is deliberate. Everything visible here is somebody else's
 * business data, and the person looking at it should never be in doubt about
 * whose screen they are on.
 */

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/stores", label: "Stores", icon: Building2 },
  { href: "/admin/users", label: "People", icon: Users },
  { href: "/admin/revenue", label: "Revenue", icon: Receipt },
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
];

const SOON = [
  { label: "Traffic", icon: BarChart3 },
  { label: "Domains", icon: Globe },
  { label: "Incidents", icon: Shield },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePlatformAdmin();

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-surface border-border hidden w-[220px] shrink-0 flex-col border-r md:flex">
        <div className="border-border flex h-14 items-center gap-2 border-b px-4">
          <Shield className="text-accent size-4" />
          <span className="font-display text-base">Operations</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="flex flex-col gap-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-text-secondary hover:bg-raised hover:text-text flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors"
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-faint mt-6 mb-2 px-2 text-[0.65rem] font-medium tracking-[0.14em] uppercase">
            Not built yet
          </p>
          <ul className="flex flex-col gap-0.5">
            {SOON.map((item) => (
              <li
                key={item.label}
                className="text-faint flex h-9 items-center gap-2.5 rounded-md px-2 text-sm"
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-border border-t p-3">
          <Link href="/app" className="text-muted hover:text-accent text-xs transition-colors">
            Back to my own shop
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-warning-soft border-warning/25 flex items-center gap-2 border-b px-4 py-1.5">
          <Shield className="text-warning size-3.5 shrink-0" />
          <p className="text-text-secondary text-xs">
            Platform operations. Everything below belongs to somebody else&rsquo;s business.
          </p>
        </div>

        <header className="border-border bg-canvas/85 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur sm:px-6">
          <nav className="flex gap-4 overflow-x-auto md:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-text-secondary text-sm whitespace-nowrap">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <p className="text-muted hidden text-xs sm:block">{actor.email}</p>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
