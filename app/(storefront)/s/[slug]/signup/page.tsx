import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SystemPageBody } from "@/components/storefront/SystemPageBody";
import { linkTo } from "@/lib/render/context";
import { systemPage } from "@/lib/schema/page";
import { loadPublishedSite } from "@/lib/stores/storefront";
import { loadAuthPage, safeNext } from "@/lib/storefront/account";

/** Making an account at a shop. Document-driven, with the same fallback as /login. */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadPublishedSite(slug);
  const page = site ? systemPage(site.doc, "signup") : undefined;
  return {
    title: page?.seo.title || "Create an account",
    robots: { index: false, follow: false },
  };
}

export default async function StoreSignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { slug } = await params;
  const { next } = await searchParams;
  const { ctx, customer } = await loadAuthPage(slug, next);
  if (customer) redirect(linkTo(ctx, safeNext(next)));

  return <SystemPageBody system="signup" fallbackType="accountSignup" ctx={ctx} />;
}
