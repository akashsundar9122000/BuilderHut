"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/lib/platform/guard";
import { resolveIncident } from "@/lib/platform/incidents";

/*
 * Mark an incident as dealt with.
 *
 * The row is never deleted and its content is never edited — "resolved" is a
 * timestamp and a name, added alongside. An operations log you can rewrite is
 * not a log, and the question this table answers most often is "how long had
 * that been broken", which only survives if nothing is tidied away.
 *
 * The guard runs inside the action, not only in the layout: a server action is
 * a POST endpoint of its own and is not protected by the page that renders the
 * button.
 */
export async function resolveIncidentAction(formData: FormData) {
  const actor = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await resolveIncident(actor.userId, id);
  revalidatePath("/admin/incidents");
  revalidatePath("/admin");
}
