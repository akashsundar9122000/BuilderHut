import "server-only";

import { eq } from "drizzle-orm";

import { customerAddresses } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { getCustomer } from "./session";

/*
 * Keeping the address somebody just typed at checkout.
 *
 * Its own module rather than a function in the actions file, because it is called
 * from checkout and could be called from the account area, and because
 * lib/commerce/cart.ts shows what happens when session concerns leak into a
 * commerce module: a dependency that only goes one way stops going one way.
 */

export interface AddressInput {
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
}

/** A no-op when nobody is signed in — there would be nowhere to put it. */
export async function saveOrderAddressToAccount(
  tenantId: string,
  address: AddressInput,
): Promise<void> {
  const customer = await getCustomer(tenantId);
  if (!customer) return;

  await withTenant({ tenantId, actorId: tenantId, role: "staff" }, async (db) => {
    const held = await db
      .select(customerAddresses)
      .where(eq(customerAddresses.customerId, customer.customerId));

    /*
     * The same address twice is not two addresses. Compared on the first line and
     * the postcode, which is enough to catch somebody checking out again from the
     * same place without pretending to normalise addresses properly.
     */
    const already = held.some(
      (row) =>
        row.line1.trim().toLowerCase() === address.line1.trim().toLowerCase() &&
        (row.postalCode ?? "") === (address.postalCode ?? ""),
    );
    if (already) return;

    // Ten is plenty, and an unbounded list is a slow page nobody asked for.
    if (held.length >= 10) return;

    await db.insert(customerAddresses, {
      ...address,
      customerId: customer.customerId,
      // The first one is the default, or checkout has nothing to prefill from.
      isDefault: held.length === 0,
    });
  });
}
