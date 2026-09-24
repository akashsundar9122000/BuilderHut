import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { GuideShell } from "@/components/guide/Shell";
import { GuideToc } from "@/components/guide/Toc";
import { GUIDE_GROUPS, GUIDE_PAGES } from "@/lib/guide/generated";

type Params = { group: string; slug: string };

const find = ({ group, slug }: Params) =>
  GUIDE_PAGES.find((page) => page.group === group && page.slug === slug);

export function generateStaticParams() {
  return GUIDE_PAGES.map((page) => ({ group: page.group, slug: page.slug }));
}

/*
 * Every page the guide has is listed above. Without this, a mistyped URL is a
 * render attempt on a server that has no such page instead of the 404 the
 * reader should have had straight away — and it quietly opts the route out of
 * being fully static.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const page = find(await params);
  if (!page) return {};

  return {
    title: page.title,
    description: page.summary,
    alternates: { canonical: `/guide/${page.group}/${page.slug}` },
    /*
     * The engineering pages are a map of this repo, written for somebody with
     * it open. Nothing in them is secret and the link works for anyone who has
     * it — they are simply noise in a search result for a merchant looking up
     * how to add a product. robots.txt is the lever that actually works; this
     * is the belt to that braces, for a page reached by a direct link.
     */
    robots: page.noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const page = find(await params);
  if (!page) notFound();

  const group = GUIDE_GROUPS.find((g) => g.id === page.group);

  /*
   * Previous and next walk the whole audience, crossing group boundaries.
   * Groups are shelving, not chapters: somebody who finishes the last page of
   * "What you sell" expects "The builder" next, not the end of the road.
   */
  const siblings = GUIDE_PAGES.filter((p) => p.audience === page.audience).sort(
    (a, b) => a.order - b.order,
  );
  const index = siblings.findIndex((p) => p.slug === page.slug && p.group === page.group);
  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = siblings[index + 1];

  const related = page.related
    .map((slug) => GUIDE_PAGES.find((p) => p.slug === slug))
    .filter((p) => p !== undefined);

  return (
    <GuideShell toc={<GuideToc headings={page.toc} />}>
      <article>
        <nav aria-label="Breadcrumb" className="text-muted text-sm">
          <Link href="/guide" className="hover:text-accent transition-colors">
            Guide
          </Link>
          {group ? <span className="text-faint"> / {group.title}</span> : null}
        </nav>

        <h1 className="font-display mt-3 text-[clamp(1.85rem,1.5rem+1.4vw,2.5rem)] leading-[1.1]">
          {page.title}
        </h1>
        <p className="text-muted mt-3 max-w-2xl text-lg leading-relaxed">{page.summary}</p>
        <p className="text-faint border-border mt-4 inline-block rounded-full border px-2.5 py-0.5 text-xs">
          {page.who}
        </p>

        {/*
          This HTML is compiled from docs/guide/**.md at build time by
          scripts/build-guide.mjs. Nothing a merchant, a staff member or a
          shopper typed can reach it, which is the only reason this is safe — a
          Markdown parser in the request path would be a live XSS surface for
          content that cannot change between deploys. tests/unit/guide.test.ts
          asserts no page carries a script tag or an inline handler.
        */}
        <div className="gd-prose mt-10" dangerouslySetInnerHTML={{ __html: page.html }} />

        {related.length > 0 ? (
          <section className="border-border mt-14 border-t pt-8">
            <h2 className="font-display text-lg">Read next</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <li key={`${item.group}/${item.slug}`}>
                  <Link
                    href={`/guide/${item.group}/${item.slug}`}
                    className="border-border bg-surface hover:border-accent-border block h-full rounded-lg border p-4 transition-colors"
                  >
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted mt-1 text-sm leading-relaxed">{item.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav
          aria-label="Guide pages"
          className="border-border mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-between"
        >
          {previous ? (
            <Link
              href={`/guide/${previous.group}/${previous.slug}`}
              className="text-text-secondary hover:text-accent inline-flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="size-4" />
              {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/guide/${next.group}/${next.slug}`}
              className="text-text-secondary hover:text-accent inline-flex items-center gap-2 text-sm transition-colors sm:text-right"
            >
              {next.title}
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </nav>
      </article>
    </GuideShell>
  );
}
