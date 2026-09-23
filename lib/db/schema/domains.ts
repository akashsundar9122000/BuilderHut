import { boolean, index, pgEnum, pgTable, text, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { nullableTimestamp, primaryId, timestamps } from "./_shared";
import { tenants } from "./tenancy";

/*
 * Custom domains.
 *
 * A hostname belongs to exactly one store at a time, which is why
 * normalized_hostname is globally unique rather than unique per tenant — the
 * one place in this schema where a merchant-facing identifier is not
 * tenant-scoped. Two shops claiming the same hostname is not a conflict to
 * resolve later; it is a routing ambiguity that must be impossible.
 *
 * Verification is a state machine with an ordered set of checkpoints, because
 * blueprint section 29 asks for a visible timeline rather than a spinner. A
 * merchant who has added a DNS record wants to know which step they are on and
 * what is still missing.
 */

export const domainStatus = pgEnum("domain_status", [
  // Added, nothing checked yet.
  "pending",
  // A DNS record exists but does not point at us.
  "misconfigured",
  // DNS points here and ownership is proven.
  "verified",
  // Verified and serving traffic.
  "active",
  // Taken out of service by the merchant or an admin.
  "disabled",
]);

export const domains = pgTable(
  "domains",
  {
    id: primaryId(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    /** As the merchant typed it, for display. */
    hostname: text("hostname").notNull(),
    /** Lowercased, trailing dot and port stripped. What routing matches on. */
    normalizedHostname: text("normalized_hostname").notNull(),
    status: domainStatus("status").notNull().default("pending"),
    /*
     * Exactly one primary per store. Alternates 301 to it, so a shop never has
     * two addresses competing for the same search listing.
     */
    isPrimary: boolean("is_primary").notNull().default(false),
    /** Random token the merchant publishes as a TXT record to prove ownership. */
    verificationToken: varchar("verification_token", { length: 64 }).notNull(),
    /** What the last check actually saw, so the UI can say why it failed. */
    lastCheckDetail: text("last_check_detail"),
    dnsCheckedAt: nullableTimestamp("dns_checked_at"),
    verifiedAt: nullableTimestamp("verified_at"),
    ...timestamps(),
  },
  (t) => [
    // Globally unique: one hostname cannot route to two shops.
    uniqueIndex("domains_normalized_hostname_key").on(t.normalizedHostname),
    index("domains_tenant_created_idx").on(t.tenantId, t.createdAt),
  ],
);
