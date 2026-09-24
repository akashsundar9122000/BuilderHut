import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireActor } from "@/lib/auth/session";
import { loadDraft } from "@/lib/builder/service";
import { STOREFRONT_FONT_VARS } from "@/lib/render/fonts";
import { themeToCss } from "@/lib/render/theme-css";
import { PreviewBar } from "./PreviewBar";

/*
 * The draft preview shell.
 *
 * The builder canvas is already a live preview — it renders the same registry
 * the storefront does — but it renders it inside a frame, at a constrained
 * width, with selection outlines and a toolbar over every section. This is the
 * same document with all of that taken away: what a customer would see if the
 * merchant published right now.
 *
 * It is deliberately the DRAFT, not the published version. The Preview button
 * used to open /s/<slug>, which is the published store — so a merchant who had
 * just spent ten minutes editing opened it and saw none of their work, which
 * reads as the editor having thrown the changes away.
 *
 * The shell below is the storefront's own layout, minus the published lookup:
 * same [data-storefront] scope, same fonts, same compiled theme. Two shells
 * would drift, and a preview that drifts from the thing it previews is worse
 * than none.
 */

export const metadata: Metadata = {
  title: "Draft preview",
  // Nobody's unpublished draft belongs in a search index.
  robots: { index: false, follow: false },
};

export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  if (!actor.tenantId) redirect("/onboarding");

  const draft = await loadDraft();
  if (!draft) redirect("/app");

  return (
    <>
      <PreviewBar storeSlug={actor.tenantSlug ?? ""} />
      <div
        data-storefront=""
        className={STOREFRONT_FONT_VARS}
        style={{
          background: "var(--sf-bg)",
          color: "var(--sf-text)",
          fontFamily: "var(--sf-font-body)",
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          // The storefront sets its own colour scheme; BuilderHut's data-theme
          // must not reach in and repaint a merchant's brand.
          colorScheme: "light dark",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: themeToCss(draft.doc.theme) }} />
        {children}
      </div>
    </>
  );
}
