"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { getRootDb } from "@/lib/db/client";
import { auditLogs, tenants } from "@/lib/db/schema";
import { requirePlatformAdmin } from "@/lib/platform/guard";

/*
 * The few things a platform operator may change.
 *
 * Suspending a shop takes it off the internet: the storefront stops resolving
 * and its custom domains stop serving. That is a serious action against
 * somebody's livelihood, so it writes an audit row with a reason and the
 * operator who did it, every time.
 *
 * Note what is NOT here. There is no way to edit a merchant's products, prices,
 * orders or customers from this console — the RLS policies the console relies
 * on are read-only, so even a bug could not do it.
 */

export type AdminState = { error?: string; ok?: boolean };

export async function setStoreStatusAction(
  _previous: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const actor = await requirePlatformAdmin();

  const tenantId = String(formData.get("tenantId") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (status !== "active" && status !== "suspended") {
    return { error: "That isn't a status." };
  }
  if (status === "suspended" && reason.length < 8) {
    // A suspension with no stated reason is impossible to review later, and
    // somebody will have to review it.
    return { error: "Say why, in a sentence. This goes in the audit log." };
  }

  const db = getRootDb();
  // tenants carries no RLS policy, so this is an ordinary write — and it is the
  // only merchant-facing row this console can change.
  await db
    .update(tenants)
    .set({
      status,
      suspendedAt: status === "suspended" ? new Date() : null,
      suspendedReason: status === "suspended" ? reason : null,
    })
    .where(eq(tenants.id, tenantId));

  await db.insert(auditLogs).values({
    id: uuidv7(),
    tenantId,
    actorId: actor.userId,
    actorRole: "platform_admin",
    action: status === "suspended" ? "store.suspended" : "store.restored",
    entityType: "tenant",
    entityId: tenantId,
    metadata: { reason: reason || null, by: actor.email },
  });

  revalidatePath("/admin/stores");
  revalidatePath("/admin");
  return { ok: true };
}
