"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  GUIDE_AUDIENCES,
  GUIDE_NAV,
  GUIDE_NAV_GROUPS,
  type GuideAudienceId,
} from "@/lib/guide/nav.generated";
import { cn } from "@/lib/cn";

/*
 * The guide's sidebar: an audience switcher, a search box, and the tree.
 *
 * It imports lib/guide/nav.generated directly rather than taking the pages as
 * props. Passing them in would serialise the whole index into the Flight
 * payload of every one of the guide's pages; importing it puts it in one shared
 * client chunk instead. The full module next door carries the rendered HTML and
 * is marked server-only precisely so this import cannot reach for it by
 * mistake.
 *
 * One audience is shown at a time. Nine groups and every page in a flat stack
 * is unusable, and worse, "products", "orders", "settings" and "analytics" each
 * name a page in both the user guide and the API reference — a flat list cannot
 * tell the reader which of the two they are about to open.
 */

/** Which audience a URL belongs to, so the switcher opens where the reader is. */
function audienceFor(pathname: string): GuideAudienceId {
  const groupId = pathname.split("/")[2];
  return GUIDE_NAV_GROUPS.find((g) => g.id === groupId)?.audience ?? "merchant";
}

const matches = (needle: string) => {
  const q = needle.toLowerCase();
  return (page: (typeof GUIDE_NAV)[number]) =>
    page.title.toLowerCase().includes(q) ||
    page.summary.toLowerCase().includes(q) ||
    page.headings.some((h) => h.toLowerCase().includes(q));
};

export function GuideNav({ id, className }: { id: string; className?: string }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  /*
   * The audience follows the URL rather than living in state. A reader who
   * lands on an API page from a search result should find the API tree open,
   * and state initialised from the first render would not survive navigating
   * to a page in a different audience.
   */
  const current = audienceFor(pathname);
  const q = query.trim();

  /*
   * While a query is active the filter spans every audience, each result
   * labelled with the one it came from. Somebody typing "webhook" wants the
   * answer wherever it lives, and silently searching only the tree they happen
   * to have open is how a guide gets a reputation for not containing something
   * it does contain.
   *
   * Titles, summaries and headings — NOT body prose. Body text would be the
   * whole guide, and putting the whole guide in a client chunk is precisely
   * what splitting the generated module in two exists to prevent. The practical
   * consequence, and it is a real one: a word that appears only in the middle
   * of a paragraph is not findable from here. That is the argument for writing
   * headings that say what the section is about.
   */
  const results = useMemo(() => {
    const pages = q ? GUIDE_NAV.filter(matches(q)) : GUIDE_NAV.filter((p) => p.audience === current);
    return GUIDE_NAV_GROUPS.map((group) => ({
      group,
      pages: pages.filter((p) => p.group === group.id).sort((a, b) => a.order - b.order),
    })).filter((section) => section.pages.length > 0);
  }, [q, current]);

  const searchId = `${id}-search`;

  return (
    <nav id={id} className={cn("text-sm", className)} aria-label="Guide">
      {/* Three in-flow links, not a select: they are three destinations. */}
      <ul className="border-border flex flex-col gap-0.5 border-b pb-4">
        {GUIDE_AUDIENCES.map((audience) => {
          const first = GUIDE_NAV.filter((p) => p.audience === audience.id).sort(
            (a, b) => a.order - b.order,
          )[0];
          if (!first) return null;
          const active = !q && audience.id === current;
          return (
            <li key={audience.id}>
              <Link
                href={`/guide/${first.group}/${first.slug}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex flex-col rounded-md px-2.5 py-1.5 transition-colors",
                  active ? "bg-raised text-text" : "text-text-secondary hover:text-text",
                )}
              >
                <span className="font-medium">{audience.label}</span>
                <span className="text-faint text-xs">{audience.blurb}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="py-4">
        <label htmlFor={searchId} className="sr-only">
          Search the guide
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the guide"
          className="border-border-input bg-surface text-text placeholder:text-faint focus-visible:border-accent-border h-9 w-full rounded-md border px-2.5 text-sm outline-none"
        />
      </div>

      {results.length === 0 ? (
        <p className="text-muted px-2.5 py-6 text-sm">
          Nothing matches <span className="text-text">{q}</span>.
        </p>
      ) : (
        <div className="flex flex-col gap-5 pb-4">
          {results.map(({ group, pages }) => (
            <div key={group.id}>
              <p className="text-faint px-2.5 pb-1.5 text-xs tracking-[0.12em] uppercase">
                {group.title}
                {/* Only while searching: otherwise every heading says the same thing. */}
                {q ? (
                  <span className="text-faint/70 normal-case">
                    {" · "}
                    {GUIDE_AUDIENCES.find((a) => a.id === group.audience)?.label}
                  </span>
                ) : null}
              </p>
              <ul className="flex flex-col">
                {pages.map((page) => {
                  const href = `/guide/${page.group}/${page.slug}`;
                  const active = pathname === href;
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-2.5 py-1.5 transition-colors",
                          active
                            ? "bg-accent-soft text-accent font-medium"
                            : "text-text-secondary hover:text-text hover:bg-raised",
                        )}
                      >
                        {page.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
