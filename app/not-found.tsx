import Link from "next/link";

import { Button } from "@/components/ui";

/*
 * The last boundary. This is what a wrong URL on builderhut.com reaches, and
 * also what a shop address that no longer resolves reaches — which is why it
 * offers both directions rather than only "back to the homepage".
 */
export default function NotFound() {
  return (
    <main className="bg-canvas flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-accent text-sm font-medium tracking-[0.18em] uppercase">404</p>
      <h1 className="font-display text-text mt-3 text-3xl sm:text-4xl">
        There&rsquo;s nothing at this address
      </h1>
      <p className="text-muted mt-3 max-w-md text-sm leading-relaxed">
        The page may have moved, or the shop you were looking for may have changed its address or
        closed.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">BuilderHut home</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/templates">Browse templates</Link>
        </Button>
      </div>
    </main>
  );
}
