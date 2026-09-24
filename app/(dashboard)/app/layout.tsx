import { redirect } from "next/navigation";

import { MobileNav } from "@/components/dashboard/MobileNav";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { getActor } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  /*
   * Signed in with no store.
   *
   * For a merchant, onboarding is the only sensible destination. For a
   * platform operator it is the wrong one: an account created by
   * `pnpm admin:bootstrap` exists to watch the platform, not to open a shop,
   * and sending it through "what do you make?" on every sign-in asks it to
   * become a merchant to do its job.
   */
  if (!actor.tenantId) redirect(actor.isPlatformAdmin ? "/admin" : "/onboarding");

  return (
    <div className="flex min-h-dvh">
      <Sidebar storeName={actor.tenantName ?? "Your store"} storeSlug={actor.tenantSlug ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar name={actor.name} email={actor.email} />
        {/* pb-20 on small screens keeps the last row clear of the bottom nav. */}
        <main className="flex-1 px-4 pt-6 pb-20 sm:px-6 sm:py-8 md:pb-8">{children}</main>
      </div>
      <MobileNav storeSlug={actor.tenantSlug ?? ""} />
    </div>
  );
}
