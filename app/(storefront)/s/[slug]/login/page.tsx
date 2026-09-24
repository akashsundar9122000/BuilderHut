import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SystemPageBody } from "@/components/storefront/SystemPageBody";
import { linkTo } from "@/lib/render/context";
import { systemPage } from "@/lib/schema/page";
import { loadPublishedSite } from "@/lib/stores/storefront";
import { loadAuthPage, safeNext } from "@/lib/storefront/account";

/*
 * Signing in to a shop.
 *
 * Document-driven: if the merchant has laid this page out in the builder, that is
 * what renders, sign-in form and all. If they have not — every store published
 * before this shipped — SystemPageBody serves the form between their header and
 * footer instead, so nothing has to be republished.
 */

// Reads the session cookie, so it can never be static. Stated rather than left to
// cookies() marking it dynamic, because a cached sign-in page on a custom
// domain's CDN would be one visitor's session served to the next.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadPublishedSite(slug);
  const page = site ? systemPage(site.doc, "login") : undefined;
  return {
    title: page?.seo.title || "Sign in",
    // Always, whatever the merchant's own noindex says. A sign-in page has no
    // business in an index — the same posture as cart and checkout.
    robots: { index: false, follow: false },
  };
}

export default async function StoreLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { slug } = await params;
  const { next } = await searchParams;
  const { ctx, customer } = await loadAuthPage(slug, next);

  // Already signed in: there is nothing to do here.
  if (customer) redirect(linkTo(ctx, safeNext(next)));

  return <SystemPageBody system="login" fallbackType="accountLogin" ctx={ctx} />;
}
