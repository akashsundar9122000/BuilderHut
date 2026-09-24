import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuideShell } from "@/components/guide/Shell";
import { GUIDE_GROUPS, GUIDE_PAGES } from "@/lib/guide/generated";

type Params = { group: string };

export function generateStaticParams() {
  return GUIDE_GROUPS.map((group) => ({ group: group.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { group: id } = await params;
  const group = GUIDE_GROUPS.find((g) => g.id === id);
  if (!group) return {};

  const hidden = GUIDE_PAGES.filter((p) => p.group === id).every((p) => p.noindex);
  return {
    title: group.title,
    description: group.blurb,
    alternates: { canonical: `/guide/${group.id}` },
    robots: hidden ? { index: false, follow: false } : undefined,
  };
}

/** One group's contents, so /guide/<group> is a page rather than a dead URL. */
export default async function GuideGroupPage({ params }: { params: Promise<Params> }) {
  const { group: id } = await params;
  const group = GUIDE_GROUPS.find((g) => g.id === id);
  if (!group) notFound();

  const pages = GUIDE_PAGES.filter((page) => page.group === group.id).sort(
    (a, b) => a.order - b.order,
  );

  return (
    <GuideShell>
      <nav aria-label="Breadcrumb" className="text-muted text-sm">
        <Link href="/guide" className="hover:text-accent transition-colors">
          Guide
        </Link>
      </nav>

      <h1 className="font-display mt-3 text-[clamp(1.85rem,1.5rem+1.4vw,2.5rem)] leading-[1.1]">
        {group.title}
      </h1>
      <p className="text-muted mt-3 max-w-2xl text-lg leading-relaxed">{group.blurb}</p>

      {pages.length === 0 ? (
        <p className="text-muted mt-10">Nothing here yet.</p>
      ) : (
        <ol className="mt-10 flex flex-col gap-3">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link
                href={`/guide/${page.group}/${page.slug}`}
                className="border-border bg-surface hover:border-accent-border block rounded-lg border p-4 transition-colors"
              >
                <p className="font-medium">{page.title}</p>
                <p className="text-muted mt-1 text-sm leading-relaxed">{page.summary}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </GuideShell>
  );
}
