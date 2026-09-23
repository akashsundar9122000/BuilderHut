import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Wizard } from "@/components/onboarding/Wizard";
import { ThemeToggle } from "@/components/ui";
import { getActor } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Set up your store" };

export default async function OnboardingPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  // Already has a store — onboarding is done and re-running it would fail.
  if (actor.tenantId) redirect("/app");

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <span className="font-display text-lg">BuilderHut</span>
        <ThemeToggle />
      </header>
      <Wizard suggestedName={actor.name} />
    </div>
  );
}
