import {
  BarChart3,
  Box,
  CreditCard,
  Gem,
  Globe,
  LayoutDashboard,
  Megaphone,
  Package,
  PanelLeft,
  Percent,
  Receipt,
  Settings,
  ShoppingBag,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";

/*
 * The merchant's sections, in one place.
 *
 * Imported by the desktop sidebar and by the phone's tab bar. It has to be a
 * module they each import rather than something passed between them: these
 * carry icon components, and a function cannot cross the server/client
 * boundary. Keeping one list is also what stops the phone quietly offering a
 * different product from the desktop, which is exactly what happened when the
 * bottom bar hard-coded four of these fifteen and forgot the rest.
 *
 * Items that do not exist yet are shown and disabled rather than hidden. A
 * merchant seeing "Orders" greyed out understands the product has orders and
 * they have not got there; a merchant seeing nothing assumes it cannot do it.
 */
export const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; icon: typeof Box; soon?: boolean }[];
}[] = [
  {
    label: "Store",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/builder", label: "Store builder", icon: PanelLeft },
      { href: "/app/products", label: "Products", icon: Package },
      { href: "/app/orders", label: "Orders", icon: ShoppingBag },
      { href: "/app/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/app/discounts", label: "Discounts", icon: Percent },
      { href: "/app/marketing", label: "Marketing", icon: Megaphone },
    ],
  },
  {
    label: "Configure",
    items: [
      { href: "/app/payments", label: "Payments", icon: CreditCard },
      { href: "/app/shipping", label: "Delivery", icon: Truck },
      { href: "/app/domains", label: "Domains", icon: Globe },
      { href: "/app/taxes", label: "Tax", icon: Receipt },
      { href: "/app/team", label: "Team", icon: UserPlus },
      { href: "/app/plan", label: "Plan", icon: Gem },
      { href: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

/*
 * The three that get a thumb-reachable slot, and why these three: the
 * dashboard to see where things stand, products because that is what a
 * merchant is forever adding and fixing, and orders because that is the one
 * they open the phone for. The builder is deliberately not here — it is not
 * usable one-handed on a bus, and pretending otherwise wastes the slot.
 */
const PRIMARY_HREFS = ["/app", "/app/products", "/app/orders"];

export const NAV_PRIMARY = NAV_GROUPS.flatMap((g) => g.items).filter((i) =>
  PRIMARY_HREFS.includes(i.href),
);

/** Everything else, keeping the sidebar's grouping so the two read alike. */
export function navOverflow(storeSlug: string) {
  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((i) => !PRIMARY_HREFS.includes(i.href)),
  })).filter((g) => g.items.length > 0);

  return [
    ...groups,
    {
      label: "Your shop",
      items: [
        {
          href: `/s/${storeSlug}`,
          label: "View my store",
          icon: Globe,
          external: true,
        },
      ],
    },
  ];
}
