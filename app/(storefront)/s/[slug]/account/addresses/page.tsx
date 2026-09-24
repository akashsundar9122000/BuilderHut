import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";

import { AccountShell } from "@/components/storefront/AccountShell";
import { AddressBook, type SavedAddress } from "@/components/storefront/AddressBook";
import { customerAddresses } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { loadAccountPage } from "@/lib/storefront/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your addresses", robots: { index: false } };

export default async function AccountAddressesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { ctx, store, customer } = await loadAccountPage(slug, "/account/addresses");

  const rows = await withTenant(
    { tenantId: store.tenantId, actorId: store.tenantId, role: "staff" },
    (db) =>
      db
        .select(customerAddresses)
        .where(eq(customerAddresses.customerId, customer.customerId))
        .orderBy(asc(customerAddresses.createdAt)),
  );

  const addresses: SavedAddress[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    country: row.country,
    isDefault: row.isDefault,
  }));

  return (
    <AccountShell
      ctx={ctx}
      slug={slug}
      title="Your addresses"
      lede="Saved here, so checkout already knows where to send things."
      active="addresses"
    >
      <AddressBook
        slug={slug}
        addresses={addresses}
        defaultCountry={ctx.account?.policy.defaultCountry ?? "IN"}
      />
    </AccountShell>
  );
}
