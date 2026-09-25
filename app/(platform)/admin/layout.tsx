import Link from "next/link";
import { Shield } from "lucide-react";

import { AdminMobileNav } from "@/components/platform/AdminMobileNav";
import { AdminTopBarActions } from "@/components/platform/AdminTopBarActions";
import { ADMIN_NAV } from "@/components/platform/admin-nav";
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
            {ADMIN_NAV.map((item) => (
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

        </nav>

        {/*
          * Only shown to an operator who actually has a shop. A bootstrapped
          * operator has none, and for them this link went to /app, which sent
          * them to onboarding — an invitation to open a shop, offered as a way
          * back to one they never had.
          */}
        {actor.tenantId ? (
          <div className="border-border border-t p-3">
            <Link href="/app" className="text-muted hover:text-accent text-xs transition-colors">
              Back to my own shop
            </Link>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-warning-soft border-warning/25 flex items-center gap-2 border-b px-4 py-1.5">
          <Shield className="text-warning size-3.5 shrink-0" />
          <p className="text-text-secondary text-xs">
            Platform operations. Everything below belongs to somebody else&rsquo;s business.
          </p>
        </div>

        <header className="border-border bg-canvas/85 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur sm:px-6">
          {/* The sections live in the bottom nav on a phone; this bar is just
              who you are and the way out. */}
          <span className="font-display text-base md:hidden">Operations</span>
          <AdminTopBarActions email={actor.email} />
        </header>

        {/* pb-24 keeps the last row of any list clear of the bottom nav. */}
        <main className="flex-1 px-4 pt-6 pb-24 sm:px-6 sm:py-8 md:pb-8">{children}</main>
      </div>

      <AdminMobileNav />
    </div>
  );
}
