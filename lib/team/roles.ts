/*
 * What each role may do, in the words a merchant would use.
 *
 * Blueprint section 2.3. The enum has existed since Phase 0; this is the part
 * that has to be readable by whoever is choosing a role for a new colleague,
 * and it is the only place the descriptions live.
 */

export const MEMBER_ROLES = ["owner", "admin", "manager", "staff"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** The roles that can be handed out. Ownership is transferred, not granted. */
export const ASSIGNABLE_ROLES = ["admin", "manager", "staff"] as const;

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

export const ROLE_BLURBS: Record<MemberRole, string> = {
  owner: "Everything, including the plan and closing the shop.",
  admin: "Everything except billing and removing the owner.",
  manager: "Products, orders, customers, discounts and the shop's design.",
  staff: "Orders and customers. Can't change prices or the design.",
};

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);
}
