import type { Metadata } from "next";

import { SystemPageBody } from "@/components/storefront/SystemPageBody";
import { systemPage } from "@/lib/schema/page";
import { loadPublishedSite } from "@/lib/stores/storefront";
import { loadAccountPage } from "@/lib/storefront/account";

/*
 * Somebody's account at a shop.
 *
 * Document-driven like /login, so a merchant can write their own words around it,
 * and signed-in-or-nowhere: loadAccountPage redirects to the shop's own sign-in
 * page rather than BuilderHut's.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadPublishedSite(slug);
  const page = site ? systemPage(site.doc, "account") : undefined;
  return {
    title: page?.seo.title || "Your account",
    robots: { index: false, follow: false },
  };
}

export default async function StoreAccountPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ctx } = await loadAccountPage(slug, "/account", { summary: true, recentOrders: 10 });
  return <SystemPageBody system="account" fallbackType="accountArea" ctx={ctx} />;
}
