"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Wordmark } from "@/components/brand/Mark";
import { Button, ThemeToggle } from "@/components/ui";

/*
 * The marketing header.
 *
 * ── Stuck state ───────────────────────────────────────────────────────────
 *
 * A 1px sentinel above it and an IntersectionObserver, not a scroll listener:
 * the browser reports the crossing itself, so there is no work on every scroll
 * frame and no getBoundingClientRect in a hot path. It writes an attribute
 * rather than setting state, so the border appearing costs no React render.
 *
 * ── The menu ──────────────────────────────────────────────────────────────
 *
 * Below `md` there was no navigation at all: a visitor on a phone could reach
 * "Create my store" and nothing else — not the templates, not the pricing, not
 * the guide. On the page whose entire job is to let someone look around first.
 *
 * It is an in-flow disclosure, deliberately not a portalled dialog. A portal
 * renders at document.body, outside this subtree — which on this site means
 * outside the marketing surface, so a panel opened over the dark hero would
 * come back in the app's own palette.
 *
 * Escape closes it and focus is not trapped. It is a short list of links, not
 * a modal task; trapping focus in it would be a worse experience than the one
 * being prevented.
 */

const LINKS = [
  { href: "/templates", label: "Templates" },
  // Root-relative, not a bare fragment: this header is shared with /templates,
  // /pricing and the whole guide, where "#how" resolves against the current
  // page and the link silently does nothing.
  { href: "/#how", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/guide", label: "Guide" },
] as const;

export function MarketingHeader() {
  const sentinel = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const mark = sentinel.current;
    const bar = header.current;
    if (!mark || !bar) return;

    const observer = new IntersectionObserver(
      ([entry]) => bar.toggleAttribute("data-stuck", !entry?.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(mark);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <header
        ref={header}
        className="bg-canvas/85 sticky top-0 z-40 border-b border-transparent backdrop-blur transition-colors duration-(--bh-duration-base) ease-(--ease-out) data-[stuck]:border-border"
      >
        <div className="mx-auto flex h-(--bh-topbar-h) max-w-6xl items-center gap-6 px-5 sm:px-8">
          <Link href="/" className="text-text hover:text-accent transition-colors">
            <Wordmark className="text-lg" />
          </Link>

          <nav
            aria-label="Main"
            className="text-text-secondary ml-6 hidden items-center gap-6 text-sm md:flex"
          >
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-accent transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Create my store</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((was) => !was)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">{open ? "Close menu" : "Menu"}</span>
            </Button>
          </div>
        </div>

        {/*
         * Hidden with `hidden` rather than unmounted, so the links are in the
         * HTML for a crawler and for a reader with no JavaScript — for whom
         * the button does nothing, which is why the nav above is also present
         * in the document at every width.
         */}
        <div
          id={panelId}
          hidden={!open}
          className="border-border bg-canvas border-t md:hidden"
        >
          <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-col px-5 py-2 sm:px-8">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-text-secondary hover:text-accent border-border border-b py-3.5 text-sm transition-colors last:border-b-0"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="text-text-secondary hover:text-accent border-border border-t py-3.5 text-sm transition-colors sm:hidden"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
