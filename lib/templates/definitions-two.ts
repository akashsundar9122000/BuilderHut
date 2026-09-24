import type { Page } from "@/lib/schema/page";
import { SCHEMA_VERSION } from "@/lib/schema/page";
import { accountPages, nav, POLICY_PAGES } from "./helpers";
import type { Template, TemplateSeed } from "./types";

/*
 * Six more starting points, one per remaining trade.
 *
 * Same bar as the first six: these must differ in composition, type
 * personality, rhythm and shape — not only in palette. A test compares the
 * ordered section types of every home page and every type pairing, so a
 * recoloured copy of an existing template fails the suite rather than shipping.
 */

function baseSettings(seed: TemplateSeed) {
  return {
    storeName: seed.storeName,
    tagline: seed.tagline,
    logoUrl: null,
    socials: { instagram: "", whatsapp: "", email: "", phone: "" },
  };
}

function policyPages(): Page[] {
  return POLICY_PAGES.map((p) => ({
    id: p.slug,
    slug: p.slug,
    title: p.title,
    hidden: false,
    seo: { noindex: false },
    sections: [
      { id: `${p.slug}-header`, type: "header" as const, props: {}, visible: true, locked: true },
      {
        id: `${p.slug}-body`,
        type: "richText" as const,
        props: {
          heading: p.title,
          body: "This is a starting point, not legal advice. Edit it to describe how your store actually works before you publish.\n\nDelete this paragraph once you have.",
          maxWidth: "narrow",
        },
        visible: true,
        locked: false,
      },
      { id: `${p.slug}-footer`, type: "footer" as const, props: {}, visible: true, locked: true },
    ],
  }));
}

function shopPage(gridProps: Record<string, unknown>): Page {
  return {
    id: "shop", slug: "shop", title: "Shop", system: "shop", hidden: false,
    seo: { noindex: false },
    sections: [
      { id: "shop-header", type: "header", props: {}, visible: true, locked: true },
      { id: "shop-grid", type: "productGrid", props: { heading: "Everything", limit: 24, ...gridProps }, visible: true, locked: false },
      { id: "shop-footer", type: "footer", props: {}, visible: true, locked: true },
    ],
  };
}

function aboutPage(title: string, body: string): Page {
  return {
    id: "about", slug: "about", title, hidden: false, seo: { noindex: false },
    sections: [
      { id: "about-header", type: "header", props: {}, visible: true, locked: true },
      { id: "about-body", type: "richText", props: { heading: title, body, maxWidth: "narrow" }, visible: true, locked: false },
      { id: "about-footer", type: "footer", props: {}, visible: true, locked: true },
    ],
  };
}

function contactPage(): Page {
  return {
    id: "contact", slug: "contact", title: "Contact", hidden: false, seo: { noindex: false },
    sections: [
      { id: "contact-header", type: "header", props: {}, visible: true, locked: true },
      { id: "contact-body", type: "contact", props: { heading: "Get in touch" }, visible: true, locked: false },
      { id: "contact-footer", type: "footer", props: {}, visible: true, locked: true },
    ],
  };
}

/* ── bloom ─── beauty & skincare ────────────────────────────────────────────
 * Clean and reassuring. This trade sells on ingredients and trust, so the
 * highlights come before the catalogue and the FAQ carries real weight.
 */
const bloom: Template = {
  id: "bloom",
  name: "Bloom",
  blurb: "Soft and reassuring, for skincare, soaps and balms.",
  industries: ["beauty", "other"],
  swatches: ["#fdf7f5", "#3b3238", "#a1685f", "#7d9c8b"],
  theme: {
    colors: {
      background: "#fdf7f5", surface: "#ffffff", raised: "#f7ebe8",
      text: "#3b3238", muted: "#75686d", border: "#ecdcd8",
      primary: "#a1685f", onPrimary: "#ffffff", accent: "#557263",
    },
    typography: {
      heading: "playfair", body: "dmsans", scale: 1.05,
      headingWeight: 400, headingTracking: -0.005, headingTransform: "none",
    },
    shape: { radius: 24, buttonRadius: 999, sectionSpacing: 96, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION, templateId: "bloom", theme: bloom.theme,
    nav: nav([["Shop", "/shop"], ["Ingredients", "/about"], ["Contact", "/contact"]]),
    footerNav: nav([["Shop", "/shop"], ["Ingredients", "/about"], ["Returns", "/refund-policy"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: {}, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            eyebrow: "Made in small batches", heading: seed.tagline || "Kind to skin, and to the rest of it",
            body: "Short ingredient lists, nothing you can't pronounce, and no claims we can't stand behind.",
            ctaLabel: "Shop the range", ctaHref: "/shop", layout: "split", height: "tall", tone: "raised",
          }, visible: true, locked: false },
          { id: "home-features", type: "featureList", props: { heading: "Why people come back", columns: 3, align: "center", items: [
            { title: "Short ingredient lists", body: "Every one printed in full on the label and the product page." },
            { title: "Never tested on animals", body: "Not by us, not by anyone we buy from." },
            { title: "Made in small batches", body: "Which is why some things sell out. We'd rather that than a warehouse." },
          ] }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "The range", limit: 6, columns: 3, imageRatio: "portrait", cardStyle: "elevated", align: "center", tone: "page" }, visible: true, locked: false },
          { id: "home-banner", type: "imageBanner", props: { heading: "What goes in", imageSide: "right", tone: "raised",
            body: "Oils cold-pressed, waxes unbleached, and scent from the plant rather than a lab. If we can't source it well, we don't make it." }, visible: true, locked: false },
          { id: "home-faq", type: "faq", props: { heading: "Before you buy", items: [
            { question: "Is this suitable for sensitive skin?", answer: "Most of the range is unscented and patch-test friendly. Say what your skin does and we'll tell you honestly which to avoid." },
            { question: "How long does it keep?", answer: "Six to nine months once opened, and every jar is dated. No preservatives means no shortcuts." },
          ] }, visible: true, locked: false },
          { id: "home-newsletter", type: "newsletter", props: { heading: "New batches, first", tone: "raised" }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { blurb: "Made by hand, in small batches." }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 3, imageRatio: "portrait", cardStyle: "elevated", align: "center" }),
      aboutPage("Ingredients", "List what you use and why.\n\nThis trade is bought on trust, and the fastest way to earn it is to be specific where competitors are vague."),
      contactPage(),
      ...policyPages(),
      ...accountPages(),
    ],
  }),
};

/* ── canvas ─── art & paintings ─────────────────────────────────────────────
 * The work first, everything else out of the way. Gallery white, enormous
 * images, type that does not compete.
 */
const canvas: Template = {
  id: "canvas",
  name: "Canvas",
  blurb: "Gallery-quiet, for originals, prints and commissions.",
  industries: ["art", "other"],
  swatches: ["#ffffff", "#1b2129", "#3d4c5c", "#8a6a3f"],
  theme: {
    colors: {
      background: "#ffffff", surface: "#ffffff", raised: "#f3f4f6",
      text: "#1b2129", muted: "#68717b", border: "#e4e6ea",
      primary: "#3d4c5c", onPrimary: "#ffffff", accent: "#8a6a3f",
    },
    typography: {
      heading: "instrument", body: "inter", scale: 0.95,
      headingWeight: 400, headingTracking: 0, headingTransform: "none",
    },
    shape: { radius: 0, buttonRadius: 0, sectionSpacing: 128, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION, templateId: "canvas", theme: canvas.theme,
    nav: nav([["Work", "/shop"], ["About", "/about"], ["Enquire", "/contact"]]),
    footerNav: nav([["Work", "/shop"], ["Enquire", "/contact"], ["Shipping", "/shipping-policy"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { showCart: true, sticky: false, showSearch: false }, visible: true, locked: true },
          { id: "home-gallery", type: "gallery", props: { columns: 2, images: [] }, visible: true, locked: false },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Recent work", layout: "minimal", align: "left", height: "compact",
            body: "Originals on paper and canvas. Prints available for most pieces.",
            ctaLabel: "See everything", ctaHref: "/shop",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "", limit: 9, columns: 3, imageRatio: "square", showPrice: true, tone: "page" }, visible: true, locked: false },
          { id: "home-text", type: "richText", props: { heading: "On commissions", maxWidth: "narrow",
            body: "I take a handful of commissions a year. Tell me the size, the room and roughly what you have in mind, and I'll say whether it's something I can do well." }, visible: true, locked: false },
          { id: "home-contact", type: "contact", props: { heading: "Enquire", align: "left", tone: "raised" }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { tone: "page" }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 3, imageRatio: "square" }),
      aboutPage("About", "Who you are and how you work.\n\nCollectors buy the artist as much as the piece. A photograph of the studio is worth a paragraph of adjectives."),
      contactPage(),
      ...policyPages(),
      ...accountPages(),
    ],
  }),
};

/* ── hamper ─── gifts ───────────────────────────────────────────────────────
 * Festive and generous. Gift buyers arrive with an occasion and a deadline,
 * so delivery timing leads rather than hides in a policy page.
 */
const hamper: Template = {
  id: "hamper",
  name: "Hamper",
  blurb: "Generous and festive, for gift boxes, hampers and sets.",
  industries: ["gifts", "other"],
  swatches: ["#fbf3ec", "#2f2a26", "#9c2f2f", "#1f6b4a"],
  theme: {
    colors: {
      background: "#fbf3ec", surface: "#ffffff", raised: "#f5e6d8",
      text: "#2f2a26", muted: "#6f6358", border: "#e8d6c4",
      primary: "#9c2f2f", onPrimary: "#ffffff", accent: "#1f6b4a",
    },
    typography: {
      heading: "fraunces", body: "inter", scale: 1.1,
      headingWeight: 700, headingTracking: -0.025, headingTransform: "none",
    },
    shape: { radius: 20, buttonRadius: 12, sectionSpacing: 84, borderWidth: 2 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION, templateId: "hamper", theme: hamper.theme,
    nav: nav([["Gifts", "/shop"], ["Corporate", "/about"], ["Contact", "/contact"]]),
    footerNav: nav([["Gifts", "/shop"], ["Delivery", "/shipping-policy"], ["Contact", "/contact"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { announcement: "Order by the 18th for Diwali delivery" }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            eyebrow: "Wrapped and ready", heading: seed.tagline || "Gifts that don't look bought in a hurry",
            body: "Boxed, tissue-wrapped and sent with a handwritten card. Tell us the message and we'll write it.",
            ctaLabel: "Browse gifts", ctaHref: "/shop", secondaryLabel: "Corporate orders", secondaryHref: "/about",
            layout: "split", height: "tall",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "Ready to send", limit: 6, columns: 3, imageRatio: "landscape", cardStyle: "bordered", tone: "page" }, visible: true, locked: false },
          { id: "home-features", type: "featureList", props: { heading: "How it works", columns: 3, align: "center", tone: "raised", items: [
            { title: "Pick a box", body: "Or tell us a budget and we'll put one together." },
            { title: "Add your message", body: "Handwritten on a card, not printed on a receipt." },
            { title: "We send it", body: "Straight to them, or to you if you'd rather hand it over." },
          ] }, visible: true, locked: false },
          { id: "home-testimonials", type: "testimonials", props: { heading: "What people said", layout: "grid", items: [
            { quote: "Sent one to a client who then asked where I'd got it. That's the whole review.", name: "Ravi M." },
            { quote: "Arrived on the morning I asked for, wrapped better than I'd have managed.", name: "Sneha P." },
          ] }, visible: true, locked: false },
          { id: "home-contact", type: "contact", props: { heading: "Ordering a lot of them?", body: "Corporate and wedding orders welcome. Tell us how many and when." }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { blurb: "Wrapped by hand." }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 3, imageRatio: "landscape", cardStyle: "bordered" }),
      aboutPage("Corporate gifting", "Volumes, lead times, branding options and what you need from a client to quote.\n\nThis is where the money is in gifting. Make it easy to ask."),
      contactPage(),
      ...policyPages(),
      ...accountPages(),
    ],
  }),
};

/* ── circuit ─── electronics & accessories ──────────────────────────────────
 * Specification-forward. This buyer reads before they buy, so text and FAQ
 * come early and the grid is dense.
 */
const circuit: Template = {
  id: "circuit",
  name: "Circuit",
  blurb: "Technical and dense, for gadgets, accessories and repairs.",
  industries: ["electronics", "other"],
  swatches: ["#f5f7f8", "#12161f", "#0e6f80", "#ab520e"],
  theme: {
    colors: {
      background: "#f5f7f8", surface: "#ffffff", raised: "#e8eef0",
      text: "#12181c", muted: "#586570", border: "#d9e1e4",
      primary: "#0e6f80", onPrimary: "#ffffff", accent: "#ab520e",
    },
    typography: {
      heading: "spacegrotesk", body: "archivo", scale: 0.95,
      headingWeight: 700, headingTracking: -0.035, headingTransform: "none",
    },
    shape: { radius: 6, buttonRadius: 6, sectionSpacing: 64, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION, templateId: "circuit", theme: circuit.theme,
    nav: nav([["Shop", "/shop"], ["Support", "/about"], ["Contact", "/contact"]]),
    footerNav: nav([["Shop", "/shop"], ["Warranty", "/refund-policy"], ["Support", "/about"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { announcement: "Free shipping over ₹999 · 1-year warranty" }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Kit that does the job", layout: "minimal", align: "left", height: "compact",
            body: "Tested before it ships. Specifications on every listing, not marketing copy.",
            ctaLabel: "Shop everything", ctaHref: "/shop",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "In stock", limit: 8, columns: 4, imageRatio: "square", cardStyle: "bordered", tone: "page" }, visible: true, locked: false },
          { id: "home-faq", type: "faq", props: { heading: "Support", items: [
            { question: "What does the warranty cover?", answer: "Manufacturing faults for twelve months. Say exactly what is and is not included — this is the question that decides the sale." },
            { question: "Do you repair what you sell?", answer: "Describe your turnaround and whether it is in-house. Buyers of technical goods want to know who fixes it when it breaks." },
          ] }, visible: true, locked: false },
          { id: "home-features", type: "featureList", props: { heading: "", columns: 4, tone: "raised", items: [
            { title: "Tested", body: "Every unit, before it leaves." },
            { title: "12-month warranty", body: "Faults replaced, not argued about." },
            { title: "Real support", body: "A person, not a form." },
            { title: "Fast dispatch", body: "Same day before 2pm." },
          ] }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { tone: "surface" }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 4, imageRatio: "square", cardStyle: "bordered" }),
      aboutPage("Support", "Warranty terms, repair turnaround, and how to reach a person.\n\nThis audience reads specifications before poetry. Be precise."),
      contactPage(),
      ...policyPages(),
      ...accountPages(),
    ],
  }),
};

/* ── hearth ─── home decor ──────────────────────────────────────────────────
 * Lifestyle-led. Decor is bought by imagining it in a room, so photography
 * carries the page and the products come after the feeling.
 */
const hearth: Template = {
  id: "hearth",
  name: "Hearth",
  blurb: "Earthy and textural, for candles, ceramics and textiles.",
  industries: ["decor", "other"],
  swatches: ["#f6f2ea", "#33302a", "#7a6a52", "#8a5b44"],
  theme: {
    colors: {
      background: "#f6f2ea", surface: "#fffdf9", raised: "#ebe4d7",
      text: "#33302a", muted: "#6d6555", border: "#ddd4c2",
      primary: "#7a6a52", onPrimary: "#fffdf9", accent: "#8a5b44",
    },
    typography: {
      heading: "lora", body: "worksans", scale: 1,
      headingWeight: 500, headingTracking: -0.01, headingTransform: "none",
    },
    shape: { radius: 3, buttonRadius: 3, sectionSpacing: 112, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION, templateId: "hearth", theme: hearth.theme,
    nav: nav([["Shop", "/shop"], ["Our making", "/about"], ["Contact", "/contact"]]),
    footerNav: nav([["Shop", "/shop"], ["Delivery", "/shipping-policy"], ["Returns", "/refund-policy"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { sticky: true }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Things worth keeping", layout: "stacked", align: "center", height: "full",
            eyebrow: "For the house", body: "Made slowly, from materials that age well rather than stay new.",
            ctaLabel: "Look around", ctaHref: "/shop",
          }, visible: true, locked: false },
          { id: "home-banner", type: "imageBanner", props: { heading: "In the workshop", imageSide: "left",
            body: "Thrown, fired and glazed here. Small variations between pieces are a record of that, not a fault.", ctaLabel: "How we make it", ctaHref: "/about" }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "Recent pieces", limit: 6, columns: 3, imageRatio: "portrait", tone: "raised" }, visible: true, locked: false },
          { id: "home-gallery", type: "gallery", props: { heading: "In other people's homes", columns: 4, images: [] }, visible: true, locked: false },
          { id: "home-newsletter", type: "newsletter", props: { heading: "New pieces, occasionally", body: "A few emails a year, when a batch comes out of the kiln." }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { blurb: "Made in the workshop, not a factory." }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 3, imageRatio: "portrait" }),
      aboutPage("Our making", "Materials, process and who does it.\n\nDecor is bought by imagining it in a room. Photographs of the making earn that imagination."),
      contactPage(),
      ...policyPages(),
      ...accountPages(),
    ],
  }),
};

/* ── stitch ─── handmade, the louder version ────────────────────────────────
 * For makers whose work is colourful and who sell on personality. Where
 * Thread is quiet and warm, this is bright and direct.
 */
const stitch: Template = {
  id: "stitch",
  name: "Stitch",
  blurb: "Bright and chatty, for makers whose work is full of colour.",
  industries: ["handmade", "crochet", "other"],
  swatches: ["#fffdf7", "#23202b", "#e0564f", "#2b7792"],
  theme: {
    colors: {
      background: "#fffdf7", surface: "#ffffff", raised: "#fdf0e6",
      text: "#23202b", muted: "#6b6575", border: "#f0e2d4",
      primary: "#d83e37", onPrimary: "#ffffff", accent: "#2b7792",
    },
    typography: {
      heading: "archivo", body: "dmsans", scale: 1.15,
      headingWeight: 700, headingTracking: -0.045, headingTransform: "none",
    },
    shape: { radius: 16, buttonRadius: 999, sectionSpacing: 72, borderWidth: 2 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION, templateId: "stitch", theme: stitch.theme,
    nav: nav([["Shop", "/shop"], ["Custom orders", "/contact"], ["About me", "/about"]]),
    footerNav: nav([["Shop", "/shop"], ["Custom orders", "/contact"], ["Shipping", "/shipping-policy"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { announcement: "Custom orders are open — message me on Instagram" }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            eyebrow: "Hello!", heading: seed.tagline || "Everything here was made at my kitchen table",
            body: "One person, a lot of yarn, and a cat who keeps helping. Custom orders always welcome.",
            ctaLabel: "See what's ready", ctaHref: "/shop", secondaryLabel: "Ask for something custom", secondaryHref: "/contact",
            layout: "split", height: "compact", tone: "raised",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "Ready to post", limit: 8, columns: 4, imageRatio: "square", cardStyle: "elevated", tone: "page" }, visible: true, locked: false },
          { id: "home-contact", type: "contact", props: { heading: "Want something made just for you?", body: "Send a picture of what you have in mind. Most custom pieces take a week or two.", align: "center", tone: "raised" }, visible: true, locked: false },
          { id: "home-testimonials", type: "testimonials", props: { layout: "grid", heading: "Nice things people said", items: [
            { quote: "Ordered a bee for my daughter and she has not put it down since.", name: "Priya", detail: "Coimbatore" },
            { quote: "The colours were exactly what I asked for, which never happens.", name: "Tom", detail: "Bristol" },
          ] }, visible: true, locked: false },
          { id: "home-gallery", type: "gallery", props: { heading: "Work in progress", columns: 4, images: [] }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { blurb: "Made at the kitchen table." }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 4, imageRatio: "square", cardStyle: "elevated" }),
      aboutPage("About me", "Who you are, where you make things, and why you started.\n\nThis template sells on personality. Write it the way you'd say it out loud."),
      contactPage(),
      ...policyPages(),
      ...accountPages(),
    ],
  }),
};

export const MORE_TEMPLATES: Template[] = [bloom, canvas, hamper, circuit, hearth, stitch];
