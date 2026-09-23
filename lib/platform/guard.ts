import "server-only";

import { redirect } from "next/navigation";

import { getActor, type Actor } from "@/lib/auth/session";

/*
 * The gate on the whole admin console.
 *
 * Every page under /admin calls this. Someone who is signed in but not a
 * platform admin is sent to their own dashboard rather than shown a "forbidden"
 * page — being told an area exists that you cannot enter is information, and
 * there is no reason to hand it out.
 */
export async function requirePlatformAdmin(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (!actor.isPlatformAdmin) redirect("/app");
  return actor;
}
