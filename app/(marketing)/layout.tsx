import Link from "next/link";
import { Wordmark } from "@/components/brand/Mark";
import { RevealNoScript } from "@/components/marketing/Reveal";
import { StaggerNoScript } from "@/components/marketing/Stagger";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { STOREFRONT_FONT_VARS } from "@/lib/render/fonts";

import "@/styles/marketing.css";

/*
 * The marketing shell.
 *
 * Two things worth knowing.
 *
 * `styles/marketing.css` is imported HERE rather than in the root layout, so
 * the dashboard, the builder and every published storefront never download a
 * byte of it. It is a lot of CSS in service of one route group.
 *
 * STOREFRONT_FONT_VARS is applied because this surface renders StoreFrame,
 * which asks for the template's real typeface. Without it those custom
 * properties are undefined and the whole font stack falls through to Georgia
 * or system-ui — so ten of the twelve templates were rendering in the wrong
 * face, on the one page whose entire argument is that they are genuinely
 * different type pairings and not one layout recoloured. The page was
 * disproving its own claim.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-mk className={`min-h-dvh ${STOREFRONT_FONT_VARS}`}>
      <RevealNoScript />
      <StaggerNoScript />

      {/*
       * How far down the page you are. Scroll-driven, so it is display:none
       * unless the browser can drive it and the reader has not asked for less
       * motion — a progress bar that cannot track progress is just a line.
       */}
      <div aria-hidden="true" className="bh-mk-progress" />

      <MarketingHeader />

      {children}

      <footer className="border-border bg-raised mt-24 border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Wordmark className="text-lg" />
            <p className="text-muted mt-2 text-sm leading-relaxed">
              A shop for people who make things. Built in Chennai.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-14 gap-y-8">
            <div className="flex flex-col gap-2.5 text-sm">
              <p className="text-faint text-xs tracking-[0.14em] uppercase">Product</p>
              <Link href="/templates" className="text-muted hover:text-text transition-colors">
                Templates
              </Link>
              <Link href="/#how" className="text-muted hover:text-text transition-colors">
                How it works
              </Link>
              <Link href="/pricing" className="text-muted hover:text-text transition-colors">
                Pricing
              </Link>
              <Link href="/guide" className="text-muted hover:text-text transition-colors">
                Guide
              </Link>
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
            <div className="flex flex-col gap-2.5 text-sm">
              <p className="text-faint text-xs tracking-[0.14em] uppercase">Developers</p>
              <Link
                href="/guide/api/overview"
                className="text-muted hover:text-text transition-colors"
              >
                API reference
              </Link>
              <Link
                href="/guide/engineering/architecture"
                className="text-muted hover:text-text transition-colors"
              >
                How it is built
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
