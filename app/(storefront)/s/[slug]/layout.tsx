import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Archivo,
  DM_Sans,
  Instrument_Serif,
  Lora,
  Playfair_Display,
  Space_Grotesk,
  Work_Sans,
} from "next/font/google";

import { themeToCss } from "@/lib/render/theme-css";
import { loadPublishedSite } from "@/lib/stores/storefront";

/*
 * The storefront shell.
 *
 * Fonts are imported here rather than in the root layout so BuilderHut's own
 * chrome never pays for nine families. next/font subsets and self-hosts them,
 * so a merchant's store makes no request to a third-party font CDN — which
 * matters for speed and for not leaking a customer's IP to Google.
 *
 * Fraunces and Inter come from the root layout; the rest are storefront-only.
 */
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dmsans", display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-worksans", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-spacegrotesk", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });

const FONT_VARS = [playfair, lora, instrument, dmSans, workSans, spaceGrotesk, archivo]
  .map((f) => f.variable)
  .join(" ");

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
      className={FONT_VARS}
      style={{
        background: "var(--sf-bg)",
        color: "var(--sf-text)",
        fontFamily: "var(--sf-font-body)",
        minHeight: "100dvh",
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
