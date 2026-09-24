import type { GuideHeading } from "@/lib/guide/types";

/*
 * "On this page".
 *
 * A server component: it is a list of anchors, and highlighting whichever
 * heading is currently in view would need an IntersectionObserver and would
 * make this a third client island for a nicety on a page that is already one
 * column of prose. The anchors themselves land correctly because styles/
 * guide.css gives every heading a scroll-margin clearing the sticky header.
 */
export function GuideToc({ headings }: { headings: GuideHeading[] }) {
  // One entry is a table of contents for nothing.
  if (headings.length < 2) return null;

  return (
    <nav aria-labelledby="gd-toc-heading" className="text-sm">
      <p id="gd-toc-heading" className="text-faint pb-2 text-xs tracking-[0.12em] uppercase">
        On this page
      </p>
      <ul className="border-border flex flex-col gap-1.5 border-l">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              className="text-text-secondary hover:text-accent -ml-px block border-l border-transparent py-0.5 pl-3 transition-colors hover:border-current"
              style={heading.depth === 3 ? { paddingLeft: "1.5rem" } : undefined}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
