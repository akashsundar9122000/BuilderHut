"use client";

import { MobileTabBar } from "@/components/ui/MobileTabBar";
import { NAV_PRIMARY, navOverflow } from "./nav";

/*
 * The phone's navigation.
 *
 * It used to hard-code four of the sidebar's fifteen items and silently drop
 * the rest — Customers, Analytics, Discounts, Marketing, Payments, Delivery,
 * Domains, Tax, Team, Plan and Settings were all unreachable on a phone. The
 * original comment argued that was deliberate: "the four things a merchant
 * opens their phone to do", with the rest left to the desktop sidebar. That is
 * a defensible line for a bottom bar and not a defensible line for a whole
 * product, because it makes the phone a strictly smaller version of the app
 * rather than the same app on a smaller screen.
 *
 * Three now, plus More, which is everything else in the sidebar's own groups.
 */
export function MobileNav({ storeSlug }: { storeSlug: string }) {
  return <MobileTabBar primary={[...NAV_PRIMARY]} groups={navOverflow(storeSlug)} />;
}
