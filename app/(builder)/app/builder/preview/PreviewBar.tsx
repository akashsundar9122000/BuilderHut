"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";

/*
 * A band across the top saying what this is.
 *
 * Without it the draft preview is indistinguishable from the live shop, and a
 * merchant looking at unpublished work in a second tab will reasonably believe
 * their customers can see it. It is fixed rather than sticky-within-the-
 * storefront, because it belongs to BuilderHut and not to the merchant's
 * design — so it uses BuilderHut's own tokens and sits outside
 * [data-storefront], where the theme cannot reach it.
 */
export function PreviewBar({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="bg-raised border-border text-text sticky top-0 z-50 flex items-center gap-3 border-b px-3 py-2 text-xs">
      <button
        onClick={() => window.close()}
        className="text-muted hover:text-text flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Close
      </button>

      <span className="border-border h-4 border-l" />

      <span className="text-text-secondary">
        <strong className="text-text font-medium">Draft preview</strong> — your unpublished
        changes. Customers still see the last published version.
      </span>

      {storeSlug ? (
        <a
          href={`/s/${storeSlug}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted hover:text-text ml-auto flex shrink-0 items-center gap-1.5 transition-colors"
        >
          <ExternalLink className="size-3.5" />
          Live store
        </a>
      ) : null}
    </div>
  );
}
