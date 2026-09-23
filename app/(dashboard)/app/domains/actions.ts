"use server";

import { revalidatePath } from "next/cache";

import { requireActor } from "@/lib/auth/session";
import { addDomain, removeDomain, setPrimaryDomain, verifyDomain } from "@/lib/domains/service";

export type DomainState = { error?: string; ok?: boolean; detail?: string };

export async function addDomainAction(
  _previous: DomainState,
  formData: FormData,
): Promise<DomainState> {
  await requireActor();
  const result = await addDomain(String(formData.get("hostname") ?? ""));
  if (!result.ok) return { error: result.message };
  revalidatePath("/app/domains");
  return { ok: true };
}

export async function verifyDomainAction(
  _previous: DomainState,
  formData: FormData,
): Promise<DomainState> {
  await requireActor();
  // A real DNS lookup, so this can take a second or two and can legitimately
  // report "not yet" — which is the useful answer while records propagate.
  const result = await verifyDomain(String(formData.get("id") ?? ""));
  revalidatePath("/app/domains");
  return { ok: result.status === "verified", detail: result.detail };
}

export async function setPrimaryAction(formData: FormData): Promise<void> {
  await requireActor();
  await setPrimaryDomain(String(formData.get("id") ?? ""));
  revalidatePath("/app/domains");
}

export async function removeDomainAction(formData: FormData): Promise<void> {
  await requireActor();
  await removeDomain(String(formData.get("id") ?? ""));
  revalidatePath("/app/domains");
}
