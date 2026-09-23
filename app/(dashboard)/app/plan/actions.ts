"use server";

import { revalidatePath } from "next/cache";

import { requireActor, runForTenant } from "@/lib/auth/session";
import { isPlanId } from "@/lib/plans/catalog";
import { changePlan } from "@/lib/plans/entitlements";

export type PlanChangeResult = { ok: true } | { ok: false; message: string };

/**
 * Move a shop between plans.
 *
 * The role check is the point: a staff member can run a shop day to day
 * without being able to change what it costs.
 */
export async function changePlanAction(planId: string): Promise<PlanChangeResult> {
  const actor = await requireActor();
  if (!actor.tenantId) return { ok: false, message: "You don't have a shop yet." };
  if (actor.role !== "owner" && actor.role !== "admin") {
    return { ok: false, message: "Only the shop's owner can change the plan." };
  }
  if (!isPlanId(planId)) return { ok: false, message: "That isn't a plan." };

  const result = await runForTenant((db) => changePlan(db, planId));
  if (result.ok) revalidatePath("/app/plan");
  return result;
}
