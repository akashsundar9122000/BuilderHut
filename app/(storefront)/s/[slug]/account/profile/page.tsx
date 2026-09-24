import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { AccountShell } from "@/components/storefront/AccountShell";
import { ProfileForm } from "@/components/storefront/ProfileForm";
import { customers } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { loadAccountPage } from "@/lib/storefront/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your details", robots: { index: false } };

export default async function AccountProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { ctx, store, customer } = await loadAccountPage(slug, "/account/profile");

  const row = await withTenant(
    { tenantId: store.tenantId, actorId: store.tenantId, role: "staff" },
    async (db) => {
      const [found] = await db.select(customers).where(eq(customers.id, customer.customerId)).limit(1);
      return found;
    },
  );

  return (
    <AccountShell ctx={ctx} slug={slug} title="Your details" active="profile">
      <ProfileForm
        slug={slug}
        customer={{
          id: customer.customerId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          emailVerified: customer.emailVerified,
          phoneVerified: customer.phoneVerified,
        }}
        acceptsMarketing={row?.acceptsMarketing ?? false}
        // A shop that signs everybody in with a code has no password to change.
        canSetPassword={ctx.account?.policy.credential !== "code"}
      />
    </AccountShell>
  );
}
