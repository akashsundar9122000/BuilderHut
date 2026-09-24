import { ImageResponse } from "next/og";

import { OgMark, OG_CONTENT_TYPE, OG_SIZE, ogFonts } from "@/lib/marketing/og";
import { templateSummaries } from "@/lib/templates";

export const alt =
  "BuilderHut — sell what you make. Build a proper online shop without writing code.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/*
 * The card every share of the site shows.
 *
 * There was none at all before this, so a link to BuilderHut arrived in a
 * WhatsApp group as a bare grey rectangle — for a product whose entire pitch
 * is that it makes things look considered.
 *
 * The strip along the bottom is the real palette of the real twelve templates,
 * read from lib/templates. It is the one honest way to say "your shop will not
 * look like everyone else's" in a picture with no room for a sentence.
 */
export default async function Image() {
  const swatches = templateSummaries().map((t) => t.theme.colors.primary);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#17130f",
          backgroundImage:
            "radial-gradient(900px 500px at 12% -10%, rgba(232,132,92,0.22), transparent 70%)",
          padding: "72px 80px",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <OgMark ink="#f5efe7" clay="#e8845c" />
          <span style={{ fontFamily: "Fraunces", fontSize: 34, color: "#f5efe7" }}>
            BuilderHut
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "Fraunces",
              fontSize: 96,
              lineHeight: 1.02,
              letterSpacing: "-0.022em",
              color: "#f5efe7",
            }}
          >
            Sell what you make.
          </span>
          <span
            style={{
              marginTop: 24,
              fontSize: 30,
              lineHeight: 1.4,
              color: "#a89c8e",
              maxWidth: 780,
            }}
          >
            A proper online shop — cart, checkout, the lot — without writing a line of code.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {swatches.map((colour) => (
            <div
              key={colour}
              /*
               * A hairline on every swatch. Two of the twelve templates lead
               * with a near-black, which on this background is an invisible
               * gap in the strip rather than a colour.
               */
              style={{
                width: 52,
                height: 10,
                borderRadius: 999,
                background: colour,
                border: "1px solid rgba(245,239,231,0.22)",
              }}
            />
          ))}
          <span style={{ marginLeft: 10, fontSize: 21, color: "#968a7a" }}>
            {swatches.length} starting points
          </span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
