"use server";

import { revalidatePath } from "next/cache";

import { requireActor } from "@/lib/auth/session";
import { refundOrder, transitionOrder } from "@/lib/commerce/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/commerce/order-state";
import { parseMoney } from "@/lib/money";

export type OrderActionState = { error?: string; ok?: boolean };

export async function transitionOrderAction(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const actor = await requireActor();
  if (!actor.tenantId) return { error: "You don't have a store." };

  const orderId = String(formData.get("orderId") ?? "");
  const to = String(formData.get("to") ?? "");
  // A status from a form is a string; only a member of the enum gets through.
  if (!ORDER_STATUSES.includes(to as OrderStatus)) return { error: "That isn't a status." };

  const result = await transitionOrder(actor.tenantId, actor.userId, orderId, to as OrderStatus);
  if (!result.ok) return { error: result.message };

  revalidatePath("/app/orders");
  revalidatePath(`/app/orders/${orderId}`);
  revalidatePath("/app");
  return { ok: true };
}

export async function refundOrderAction(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const actor = await requireActor();
  if (!actor.tenantId) return { error: "You don't have a store." };

  const orderId = String(formData.get("orderId") ?? "");
  const currency = String(formData.get("currency") ?? "INR");
  const amount = parseMoney(String(formData.get("amount") ?? ""), currency);
  if (amount === null) return { error: "Enter an amount like 499 or 499.50." };

  const result = await refundOrder(
    actor.tenantId,
    actor.userId,
    orderId,
    amount,
    String(formData.get("reason") ?? "") || undefined,
  );
  if (!result.ok) return { error: result.message };

  revalidatePath("/app/orders");
  revalidatePath(`/app/orders/${orderId}`);
  revalidatePath("/app");
  return { ok: true };
}
