"use client";

import { MobileTabBar } from "@/components/ui/MobileTabBar";
import { ADMIN_OVERFLOW, ADMIN_PRIMARY } from "@/components/platform/admin-nav";

/*
 * The operator console's navigation, on a phone.
 *
 * Which three, and why, is recorded next to the list in admin-nav.ts. The
 * behaviour itself lives in MobileTabBar, shared with the merchant dashboard —
 * both had the same problem in different shapes, and two copies of a bottom
 * bar is two places for the sheet to stop closing on navigation.
 */
export function AdminMobileNav() {
  return (
    <MobileTabBar
      primary={ADMIN_PRIMARY}
      groups={[{ label: "More sections", items: ADMIN_OVERFLOW }]}
    />
  );
}
