import Link from "next/link";
import { Wordmark } from "@/components/brand/Mark";
import { RevealNoScript } from "@/components/marketing/Reveal";
import { Button, ThemeToggle } from "@/components/ui";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <RevealNoScript />
      <header className="border-border/70 bg-canvas/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="text-text hover:text-accent transition-colors">
            <Wordmark className="text-lg" />
          </Link>
          <nav className="text-text-secondary ml-6 hidden items-center gap-6 text-sm md:flex">
            <Link href="/templates" className="hover:text-accent transition-colors">
              Templates
            </Link>
            <a href="#how" className="hover:text-accent transition-colors">
              How it works
            </a>
            <a href="#pricing" className="hover:text-accent transition-colors">
              Pricing
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Create my store</Link>
            </Button>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-border bg-raised mt-24 border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Wordmark className="text-lg" />
            <p className="text-muted mt-2 text-sm leading-relaxed">
              A shop for people who make things. Built in Chennai.
            </p>
          </div>
          <div className="flex gap-14">
            <div className="flex flex-col gap-2.5 text-sm">
              <p className="text-faint text-xs tracking-[0.14em] uppercase">Product</p>
              <Link href="/templates" className="text-muted hover:text-text transition-colors">
                Templates
              </Link>
              <a href="#how" className="text-muted hover:text-text transition-colors">
                How it works
              </a>
              <a href="#pricing" className="text-muted hover:text-text transition-colors">
                Pricing
              </a>
            </div>
            <div className="flex flex-col gap-2.5 text-sm">
              <p className="text-faint text-xs tracking-[0.14em] uppercase">Get started</p>
              <Link href="/signup" className="text-muted hover:text-text transition-colors">
                Create a store
              </Link>
              <Link href="/login" className="text-muted hover:text-text transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </div>
        <div className="border-border mx-auto max-w-6xl border-t px-5 py-6 sm:px-8">
          <p className="text-faint text-xs">© {new Date().getFullYear()} BuilderHut</p>
        </div>
      </footer>
    </div>
  );
}
