"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { requireActor, runForTenant } from "@/lib/auth/session";
import { storeSettings } from "@/lib/db/schema";
import { requireFeature, EntitlementError } from "@/lib/plans/entitlements";

export async function setRemindersAction(
  enabled: boolean,
): Promise<{ ok: boolean; message?: string }> {
  const actor = await requireActor();
  if (!actor.tenantId) return { ok: false, message: "You don't have a shop yet." };

  try {
    /*
     * Checked when turning it ON, not off. A shop that drops to a smaller plan
     * must always be able to switch it off, and refusing that would be a
     * setting they can see, cannot change, and which does nothing.
     */
    if (enabled) await requireFeature(actor.tenantId, "marketingTools");
  } catch (error) {
    if (error instanceof EntitlementError) return { ok: false, message: error.message };
    throw error;
  }

  await runForTenant(async (db) => {
    const [existing] = await db.select(storeSettings).limit(1);
    if (existing) {
      await db.update(storeSettings, { remindUnpaidOrders: enabled }, eq(storeSettings.id, existing.id));
    } else {
      await db.insert(storeSettings, { remindUnpaidOrders: enabled });
    }
  });

  revalidatePath("/app/marketing");
  return { ok: true };
}
