"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireActor } from "@/lib/auth/session";
import { INDUSTRY_IDS } from "@/lib/industries";
import { createStore, isSlugAvailable } from "@/lib/stores/create";
import { getTemplateIds } from "@/lib/templates";

/*
 * Server actions for onboarding.
 *
 * Everything the wizard collects is re-validated here. The client validates too,
 * for the feedback, but a server action is a public endpoint — the browser can
 * call it with anything.
 */

const CreateStoreSchema = z.object({
  name: z.string().trim().min(2, "Your store needs a name.").max(80),
  slug: z.string().trim().toLowerCase(),
  industry: z.enum(INDUSTRY_IDS as [string, ...string[]]),
  templateId: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  country: z.string().regex(/^[A-Z]{2}$/),
  timezone: z.string().min(3).max(64),
  salesChannel: z.string().max(32),
  goal: z.string().max(32),
});

export type CreateStoreState = {
  error?: string;
  field?: "slug" | "form";
};

export async function createStoreAction(
  _previous: CreateStoreState,
  formData: FormData,
): Promise<CreateStoreState> {
  const actor = await requireActor();

  const parsed = CreateStoreSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    industry: formData.get("industry"),
    templateId: formData.get("templateId"),
    currency: formData.get("currency"),
    country: formData.get("country"),
    timezone: formData.get("timezone"),
    salesChannel: formData.get("salesChannel"),
    goal: formData.get("goal"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Something in that form isn't right.", field: "form" };
  }

  // A template id from the browser is a component-registry key. Never trust one.
  if (!getTemplateIds().includes(parsed.data.templateId)) {
    return { error: "That template doesn't exist.", field: "form" };
  }

  const result = await createStore({ userId: actor.userId, ...parsed.data });
  if (!result.ok) return { error: result.message, field: result.field };

  redirect("/app?welcome=1");
}

export async function checkSlugAction(slug: string): Promise<{ available: boolean }> {
  await requireActor();
  return { available: await isSlugAvailable(slug.trim().toLowerCase()) };
}
