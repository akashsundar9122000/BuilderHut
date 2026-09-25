import {
  BarChart3,
  Building2,
  FileClock,
  Globe,
  LayoutDashboard,
  Receipt,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

/*
 * The operator console's sections, in one place.
 *
 * Imported by both the server layout (for the desktop sidebar) and the client
 * bottom nav. It has to be a module they each import rather than a prop passed
 * between them: these entries carry icon components, and a function cannot
 * cross the server/client boundary — React refuses to serialize it, and the
 * error names the field rather than the reason.
 */

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/stores", label: "Stores", icon: Building2 },
  { href: "/admin/users", label: "People", icon: Users },
  { href: "/admin/traffic", label: "Traffic", icon: BarChart3 },
  { href: "/admin/revenue", label: "Revenue", icon: Receipt },
  { href: "/admin/domains", label: "Domains", icon: Globe },
  { href: "/admin/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
];

/*
 * The three that get a thumb-reachable slot on a phone, and the judgement
 * behind it: Overview to see the state of things, Stores because every
 * investigation starts at a shop, and Incidents because it is the only screen
 * that means somebody has to do something now. Revenue and the audit log are
 * deliberate destinations and are worth a second tap.
 */
const PRIMARY_HREFS = ["/admin", "/admin/stores", "/admin/incidents"];

export const ADMIN_PRIMARY = ADMIN_NAV.filter((i) => PRIMARY_HREFS.includes(i.href));
export const ADMIN_OVERFLOW = ADMIN_NAV.filter((i) => !PRIMARY_HREFS.includes(i.href));
