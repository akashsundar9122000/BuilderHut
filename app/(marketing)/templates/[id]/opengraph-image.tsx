import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";

import { OgMark, OG_CONTENT_TYPE, OG_SIZE, ogFonts } from "@/lib/marketing/og";
import { getTemplate, TEMPLATES } from "@/lib/templates";

export const alt = "A BuilderHut template";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }));
}

/*
 * A card per template, drawn in that template's own colours.
 *
 * Which means the argument the page makes — these are twelve genuinely
 * different designs, not one layout recoloured — is already made in the link
 * preview, before anybody has opened anything. And because every value is read
 * from the template's real theme, a change to a palette moves the card with
 * it; there is no second copy of these colours to go stale.
 *
 * The typeface is Fraunces rather than the template's own. Satori would need
 * each of the seven storefront faces shipped as a static instance to do
 * otherwise, and four hundred kilobytes of font files to set one word on a
 * picture is not a good trade.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) notFound();

  const { colors } = template.theme;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: colors.background,
          color: colors.text,
          padding: "72px 80px",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <OgMark size={34} ink={colors.text} clay={colors.primary} />
          <span style={{ fontSize: 22, color: colors.muted }}>A BuilderHut template</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "Fraunces",
              fontSize: 104,
              lineHeight: 1,
              letterSpacing: "-0.022em",
              color: colors.text,
            }}
          >
            {template.name}
          </span>
          <span
            style={{
              marginTop: 26,
              fontSize: 32,
              lineHeight: 1.35,
              color: colors.muted,
              maxWidth: 820,
            }}
          >
            {template.blurb}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {template.swatches.map((colour) => (
            <div
              key={colour}
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: colour,
                border: `1px solid ${colors.border}`,
              }}
            />
          ))}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              padding: "16px 34px",
              borderRadius: template.theme.shape.buttonRadius,
              background: colors.primary,
              color: colors.onPrimary,
              fontSize: 26,
            }}
          >
            Shop now
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
