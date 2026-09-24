import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/app-url";
import { GUIDE_GROUPS, GUIDE_PAGES } from "@/lib/guide/generated";

/*
 * The pages worth finding from a search engine.
 *
 * Guide entries are derived from the registry rather than listed by hand, and
 * filtered on the same `noindex` flag the page's own metadata uses — so the two
 * cannot disagree about whether a page is public.
 *
 * Merchant storefronts are deliberately absent. A shop at /s/<slug> or on its
 * own domain is the merchant's to have indexed; listing every tenant on
 * BuilderHut's apex would publish a directory of our customers.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();

  const groups = GUIDE_GROUPS.filter((group) =>
    GUIDE_PAGES.some((page) => page.group === group.id && !page.noindex),
  );

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/templates`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/guide`, changeFrequency: "weekly", priority: 0.7 },
    ...groups.map((group) => ({
      url: `${base}/guide/${group.id}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...GUIDE_PAGES.filter((page) => !page.noindex).map((page) => ({
      url: `${base}/guide/${page.group}/${page.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
