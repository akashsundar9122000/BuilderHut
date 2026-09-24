import type { MetadataRoute } from "next";

import { appUrl } from "@/lib/app-url";
import { GUIDE_GROUPS } from "@/lib/guide/generated";

/*
 * What a crawler may index.
 *
 * The engineering guide is disallowed here and carries a runtime noindex as
 * well. It is not secret — it is a map of this repo, and the link works for
 * anybody who has it — but a merchant searching for "BuilderHut add a product"
 * must not land in the chapter about row-level security.
 *
 * The disallow list is derived from the group table rather than written out, so
 * a new engineering page cannot be forgotten into the index.
 *
 * Known gap, worth writing down: on a merchant's custom domain, middleware
 * rewrites /robots.txt into /s/<slug>/robots.txt and it 404s. Storefront-level
 * SEO files are a separate piece of work.
 */
export default function robots(): MetadataRoute.Robots {
  const hidden = GUIDE_GROUPS.filter((group) => group.audience === "engineering").map(
    (group) => `/guide/${group.id}`,
  );

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/onboarding", "/api", "/dev", "/verify", ...hidden],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
