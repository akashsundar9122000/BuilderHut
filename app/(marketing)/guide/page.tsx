import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GUIDE_GROUPS, GUIDE_PAGES } from "@/lib/guide/generated";
import { GUIDE_AUDIENCES } from "@/lib/guide/nav.generated";

export const metadata: Metadata = {
  title: "Guide",
  description:
    "How to use BuilderHut, how to build against it, and how it is built — every screen, in plain words.",
  alternates: { canonical: "/guide" },
};

/*
 * The guide's front door.
 *
 * Three audiences, each with its groups underneath, rather than one long list.
 * The three want genuinely different things, and a single index makes a shop
 * owner scroll past the API reference to find out how to add a product.
 */
export default function GuideIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-accent text-xs font-medium tracking-[0.18em] uppercase">The guide</p>
      <h1 className="font-display mt-4 max-w-2xl text-[clamp(2rem,1.5rem+2.2vw,3.2rem)] leading-[1.06]">
        Every screen, explained in plain words.
      </h1>
      <p className="text-muted mt-5 max-w-xl text-lg leading-relaxed">
        Written for the person using it, with pictures of the actual thing. Free to read, and no
        account needed.
      </p>

      <div className="mt-16 flex flex-col gap-14">
        {GUIDE_AUDIENCES.map((audience) => {
          const groups = GUIDE_GROUPS.filter((group) => group.audience === audience.id)
            .map((group) => ({
              group,
              pages: GUIDE_PAGES.filter((page) => page.group === group.id).sort(
                (a, b) => a.order - b.order,
              ),
            }))
            .filter((section) => section.pages.length > 0);

          if (groups.length === 0) return null;
          const first = groups[0]!.pages[0]!;

          return (
            <section key={audience.id}>
              <div className="border-border flex flex-wrap items-baseline justify-between gap-3 border-b pb-3">
                <div>
                  <h2 className="font-display text-2xl">{audience.label}</h2>
                  <p className="text-muted mt-1 text-sm">{audience.blurb}</p>
                </div>
                <Link
                  href={`/guide/${first.group}/${first.slug}`}
                  className="text-accent hover:text-accent-hover group inline-flex items-center gap-1 text-sm font-medium transition-colors"
                >
                  Start reading
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {groups.map(({ group, pages }) => (
                  <div
                    key={group.id}
                    className="border-border bg-surface rounded-lg border p-5"
                  >
                    <h3 className="font-display text-lg">
                      <Link href={`/guide/${group.id}`} className="hover:text-accent transition-colors">
                        {group.title}
                      </Link>
                    </h3>
                    <p className="text-muted mt-1 text-sm leading-relaxed">{group.blurb}</p>
                    <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                      {pages.slice(0, 5).map((page) => (
                        <li key={page.slug}>
                          <Link
                            href={`/guide/${page.group}/${page.slug}`}
                            className="text-text-secondary hover:text-accent transition-colors"
                          >
                            {page.title}
                          </Link>
                        </li>
                      ))}
                      {pages.length > 5 ? (
                        <li>
                          <Link
                            href={`/guide/${group.id}`}
                            className="text-faint hover:text-accent transition-colors"
                          >
                            and {pages.length - 5} more
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
