import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { appUrl } from "@/lib/app-url";
import { themeScript } from "@/lib/theme";
import "@/styles/tokens.css";

/*
 * The pairing is the identity. Fraunces is a warm, slightly wonky old-style
 * serif — it reads "made by a person", which is the whole audience. Inter
 * carries the interface and gets out of the way. Most SaaS uses one grotesque
 * for everything; that sameness is exactly what this product can't afford.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for canonical links and social cards. appUrl() already knows
  // the difference between a preview deployment and production; a hard-coded
  // constant would make every preview claim to be the real site.
  metadataBase: new URL(appUrl()),
  title: {
    default: "BuilderHut — Sell what you make",
    template: "%s · BuilderHut",
  },
  description:
    "Build a beautiful online store without writing code. Pick a template, customise everything visually, add your products, and publish.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Stamps data-theme before first paint, so dark mode never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
