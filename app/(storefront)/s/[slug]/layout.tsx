import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STOREFRONT_FONT_VARS } from "@/lib/render/fonts";
import { themeToCss } from "@/lib/render/theme-css";
import { loadPublishedSite } from "@/lib/stores/storefront";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadPublishedSite(slug);
  if (!site) return { title: "Store not found" };

  const home = site.doc.pages.find((p) => p.system === "home");
  return {
    // Absolute, so a storefront's <title> is the merchant's brand and not
    // "… · BuilderHut". Their customers are not our audience.
    title: { absolute: home?.seo.title || site.storeName },
    description: home?.seo.description || site.doc.settings.tagline || undefined,
    openGraph: {
      title: home?.seo.title || site.storeName,
      description: home?.seo.description || site.doc.settings.tagline || undefined,
      type: "website",
    },
    robots: home?.seo.noindex ? { index: false, follow: false } : undefined,
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = await loadPublishedSite(slug);
  if (!site) notFound();

  return (
    <div
      data-storefront=""
      className={STOREFRONT_FONT_VARS}
      style={{
        background: "var(--sf-bg)",
        color: "var(--sf-text)",
        fontFamily: "var(--sf-font-body)",
        minHeight: "100dvh",
        /*
         * A sticky footer. Without it a short page — an empty basket, a page
         * that wasn't found — leaves the footer floating halfway up with a
         * band of background beneath it, which reads as a broken layout.
         */
        display: "flex",
        flexDirection: "column",
        // The storefront sets its own colour scheme; BuilderHut's data-theme
        // must not reach in and repaint a merchant's brand.
        colorScheme: "light dark",
      }}
    >
      {/* Compiled from the published theme, scoped to [data-storefront]. */}
      <style dangerouslySetInnerHTML={{ __html: themeToCss(site.doc.theme) }} />
      {children}
    </div>
  );
}
