import Link from "next/link";
import { Button, ThemeToggle } from "@/components/ui";

/*
 * Placeholder. The real landing page — cinematic hero, animated store previews,
 * interactive template carousel, scroll storytelling — is a Phase 1 deliverable.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">
        Phase 0 · Foundations
      </p>
      <h1 className="font-display text-5xl leading-[1.05] sm:text-6xl">Sell what you make.</h1>
      <p className="text-muted max-w-md text-balance">
        BuilderHut is being built. The design system and data layer are in place; the storefront
        builder comes next.
      </p>
      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/dev/theme">View the design system</Link>
        </Button>
        <ThemeToggle />
      </div>
    </main>
  );
}
