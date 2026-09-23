import type { Page } from "@/lib/schema/page";
import { SCHEMA_VERSION } from "@/lib/schema/page";
import { nav, POLICY_PAGES } from "./helpers";
import type { Template, TemplateSeed } from "./types";

/*
 * The first six starting points. The rest are in definitions-two.ts.
 *
 * Blueprint section 0.1 is blunt about the bar: a crochet store, an invitation
 * studio, a streetwear label, a jeweller, a bakery and a digital seller must
 * feel like different brands, not one layout recoloured. So these differ in
 * composition (which sections, in what order), in type personality (serif
 * against grotesque, tracking, case), in rhythm (section spacing, image ratio)
 * and in shape (radius 0 against radius 16) — not only in palette.
 *
 * Four of those axes are checked mechanically in tests/unit/templates.test.ts:
 * the ordered section types of each home page, the type pairing, the button
 * colour (perceptibly apart, not merely different) and the product-card
 * treatment. Taste is still a review question, but a recolour now fails CI.
 *
 * Each `build` returns a complete, publishable document. A merchant who changes
 * nothing still has a coherent store, which is the point of a template.
 */

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
          body: `This is a starting point, not legal advice. Edit it to describe how your store actually works before you publish.\n\nDelete this paragraph once you have.`,
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
    id: "shop",
    slug: "shop",
    title: "Shop",
    system: "shop",
    hidden: false,
    seo: { noindex: false },
    sections: [
      { id: "shop-header", type: "header", props: {}, visible: true, locked: true },
      { id: "shop-grid", type: "productGrid", props: { heading: "Everything", limit: 24, ...gridProps }, visible: true, locked: false },
      { id: "shop-footer", type: "footer", props: {}, visible: true, locked: true },
    ],
  };
}

/* ── thread ─────────────────────────────────────────────────────────────────
 * Crochet, handmade, home decor. Warm paper, a soft serif, storytelling before
 * catalogue — because these makers sell the fact that a person made it.
 */
const thread: Template = {
  id: "thread",
  name: "Thread",
  blurb: "Warm and unhurried, for things made slowly by hand.",
  industries: ["crochet", "handmade", "decor", "gifts", "other"],
  swatches: ["#faf6f0", "#2f2a24", "#b0603f", "#5c7a5e"],
  theme: {
    colors: {
      background: "#faf6f0", surface: "#ffffff", raised: "#f2ebe1",
      text: "#2f2a24", muted: "#6f6559", border: "#e3d9ca",
      primary: "#b0603f", onPrimary: "#ffffff", accent: "#5c7a5e",
    },
    typography: {
      heading: "fraunces", body: "worksans", scale: 1,
      headingWeight: 400, headingTracking: -0.015, headingTransform: "none",
    },
    shape: { radius: 14, buttonRadius: 999, sectionSpacing: 88, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION,
    templateId: "thread",
    theme: thread.theme,
    nav: nav([["Shop", "/shop"], ["Our story", "/about"], ["Contact", "/contact"]]),
    footerNav: nav([["Shop", "/shop"], ["Shipping", "/shipping-policy"], ["Returns", "/refund-policy"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { announcement: "Free delivery on orders over ₹1,500" }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            eyebrow: "Handmade to order", heading: seed.tagline || "Made slowly, by hand",
            body: "Every piece is worked one stitch at a time, so no two are quite alike. That's rather the point.",
            ctaLabel: "Browse the shop", ctaHref: "/shop", layout: "split", height: "tall",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "New in", body: "", limit: 4, columns: 4, imageRatio: "square", tone: "page" }, visible: true, locked: false },
          { id: "home-story", type: "imageBanner", props: {
            heading: "How it's made", imageSide: "left", tone: "raised",
            body: "It starts with choosing the yarn — colour, weight, how it behaves in the hand. Then a few hours per piece, and a little longer for the fiddly ones.",
            ctaLabel: "Read our story", ctaHref: "/about",
          }, visible: true, locked: false },
          { id: "home-features", type: "featureList", props: { heading: "", columns: 3, items: [
            { title: "Made to order", body: "Nothing sits in a warehouse. We start yours when you order it." },
            { title: "Ships in 3–5 days", body: "Across India, carefully wrapped and tracked." },
            { title: "Custom colours", body: "Message us and we'll work in the shade you want." },
          ] }, visible: true, locked: false },
          { id: "home-testimonials", type: "testimonials", props: { layout: "single", tone: "raised", items: [
            { quote: "I ordered a posy for my mother and she has it on the windowsill where the real ones used to go.", name: "Divya R.", detail: "Chennai" },
          ] }, visible: true, locked: false },
          { id: "home-contact", type: "contact", props: { heading: "Want something specific?", body: "Custom orders are most of what we do. Send a photo of what you have in mind." }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { blurb: "Handmade in small batches." }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 4, imageRatio: "square" }),
      aboutPage("Our story", "We started with one pattern and a lot of leftover yarn.\n\nTell your own version here: how you began, what you care about, why someone should buy from a person rather than a factory."),
      contactPage(),
      ...policyPages(),
    ],
  }),
};

/* ── leaflet ────────────────────────────────────────────────────────────────
 * Invitations, stationery, art. Centred and quiet, a high-contrast display
 * serif, portfolio before price — this trade sells on craft and taste.
 */
const leaflet: Template = {
  id: "leaflet",
  name: "Leaflet",
  blurb: "Quiet and typographic, for invitations, prints and commissions.",
  industries: ["invitations", "art", "other"],
  swatches: ["#ffffff", "#1a1a1a", "#8c7851", "#f4f1ea"],
  theme: {
    colors: {
      background: "#ffffff", surface: "#ffffff", raised: "#f6f3ec",
      text: "#1a1a1a", muted: "#6d6a63", border: "#e6e1d6",
      primary: "#1a1a1a", onPrimary: "#ffffff", accent: "#8c7851",
    },
    typography: {
      heading: "playfair", body: "lora", scale: 1.05,
      headingWeight: 400, headingTracking: -0.01, headingTransform: "none",
    },
    shape: { radius: 2, buttonRadius: 2, sectionSpacing: 104, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION,
    templateId: "leaflet",
    theme: leaflet.theme,
    nav: nav([["Work", "/shop"], ["Process", "/about"], ["Enquire", "/contact"]]),
    footerNav: nav([["Work", "/shop"], ["Enquire", "/contact"], ["Terms", "/terms"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { showCart: false, sticky: false }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Paper, pressed and printed", layout: "minimal", align: "center",
            body: "Wedding invitations, save-the-dates and stationery, designed one commission at a time.",
            ctaLabel: "See the work", ctaHref: "/shop", secondaryLabel: "Start an enquiry", secondaryHref: "/contact",
          }, visible: true, locked: false },
          { id: "home-gallery", type: "gallery", props: { columns: 3, images: [] }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "Collections", limit: 6, columns: 3, imageRatio: "landscape", showPrice: false, align: "center", tone: "raised" }, visible: true, locked: false },
          { id: "home-process", type: "featureList", props: { heading: "How a commission works", align: "center", columns: 3, items: [
            { title: "01 — Tell us about the day", body: "Dates, names, the feeling you're after." },
            { title: "02 — We draft", body: "Two directions, then refinements until it's right." },
            { title: "03 — Print and deliver", body: "Proofed, printed and sent to you or your guests." },
          ] }, visible: true, locked: false },
          { id: "home-faq", type: "faq", props: { heading: "Before you enquire", items: [
            { question: "How far ahead should I order?", answer: "Eight to ten weeks before you want to send them is comfortable. We can work faster, but it costs more and leaves less room to change your mind." },
            { question: "Can I see a sample first?", answer: "Yes. Sample packs are sent free within India; tell us which collections interest you." },
          ] }, visible: true, locked: false },
          { id: "home-contact", type: "contact", props: { heading: "Start an enquiry", body: "Tell us the date and we'll tell you what's possible.", align: "center", tone: "raised" }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: {}, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 3, imageRatio: "landscape", showPrice: false, align: "center" }),
      aboutPage("Process", "Describe how you work — what a client can expect, how long it takes, what you need from them.\n\nThis trade sells on trust and taste. Show both."),
      contactPage(),
      ...policyPages(),
    ],
  }),
};

/* ── cutline ────────────────────────────────────────────────────────────────
 * Streetwear, prints, electronics accessories. Sharp corners, uppercase
 * grotesque, a dense grid and a dark band — loud on purpose.
 */
const cutline: Template = {
  id: "cutline",
  name: "Cutline",
  blurb: "Sharp and loud, for drops, prints and labels.",
  industries: ["clothing", "electronics", "other"],
  swatches: ["#0c0c0d", "#f5f5f4", "#e6ff3d", "#7c7c7a"],
  theme: {
    colors: {
      background: "#0c0c0d", surface: "#161617", raised: "#1e1e20",
      text: "#f5f5f4", muted: "#a3a3a0", border: "#2b2b2e",
      primary: "#e6ff3d", onPrimary: "#0c0c0d", accent: "#e6ff3d",
    },
    typography: {
      heading: "archivo", body: "spacegrotesk", scale: 1.1,
      headingWeight: 700, headingTracking: -0.04, headingTransform: "uppercase",
    },
    shape: { radius: 0, buttonRadius: 0, sectionSpacing: 72, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION,
    templateId: "cutline",
    theme: cutline.theme,
    nav: nav([["Shop", "/shop"], ["Lookbook", "/about"], ["Contact", "/contact"]]),
    footerNav: nav([["Shop", "/shop"], ["Shipping", "/shipping-policy"], ["Returns", "/refund-policy"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { announcement: "NEW DROP — LIMITED RUN", tone: "page" }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Season one", layout: "stacked", align: "center", height: "tall",
            eyebrow: "Limited run", body: "Printed in small batches. When they're gone they're gone.",
            ctaLabel: "Shop the drop", ctaHref: "/shop",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "The drop", limit: 8, columns: 4, imageRatio: "portrait", cardStyle: "plain", tone: "page" }, visible: true, locked: false },
          { id: "home-banner", type: "imageBanner", props: {
            heading: "Built to be worn out", imageSide: "right", tone: "raised",
            body: "Heavyweight cotton, screen printed, pre-shrunk. Wash it cold and it'll outlast the trend.",
            ctaLabel: "Size guide", ctaHref: "/about",
          }, visible: true, locked: false },
          { id: "home-gallery", type: "gallery", props: { heading: "Lookbook", columns: 4, images: [] }, visible: true, locked: false },
          { id: "home-newsletter", type: "newsletter", props: { heading: "Get the next drop first", body: "No spam. Just the date and the link, a day early.", tone: "primary" }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { tone: "surface" }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 4, imageRatio: "portrait" }),
      aboutPage("Lookbook", "Put the sizing chart, the fabric details and the shoot here.\n\nThis audience reads specifications before it reads poetry."),
      contactPage(),
      ...policyPages(),
    ],
  }),
};

/* ── facet ──────────────────────────────────────────────────────────────────
 * Jewellery and beauty. Dark, wide and slow: few products, each given room.
 */
const facet: Template = {
  id: "facet",
  name: "Facet",
  blurb: "Dark and unhurried, for jewellery and small luxuries.",
  industries: ["jewellery", "beauty", "other"],
  swatches: ["#14100f", "#f0ece6", "#c9a227", "#2a2320"],
  theme: {
    colors: {
      background: "#14100f", surface: "#1c1715", raised: "#241d1a",
      text: "#f0ece6", muted: "#a9a09a", border: "#332a26",
      primary: "#c9a227", onPrimary: "#14100f", accent: "#c9a227",
    },
    typography: {
      heading: "lora", body: "inter", scale: 1,
      headingWeight: 400, headingTracking: 0.02, headingTransform: "none",
    },
    shape: { radius: 4, buttonRadius: 999, sectionSpacing: 120, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION,
    templateId: "facet",
    theme: facet.theme,
    nav: nav([["Collections", "/shop"], ["The house", "/about"], ["Contact", "/contact"]]),
    footerNav: nav([["Collections", "/shop"], ["Care", "/about"], ["Returns", "/refund-policy"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { sticky: true }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Worn every day, or once", layout: "split", height: "full",
            eyebrow: "New collection", body: "Silver and stone, set by hand in small numbers.",
            ctaLabel: "View the collection", ctaHref: "/shop",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "The collection", limit: 3, columns: 3, imageRatio: "square", cardStyle: "bordered", align: "center", tone: "surface" }, visible: true, locked: false },
          { id: "home-text", type: "richText", props: { align: "center", tone: "page", heading: "Made to be kept",
            body: "Each piece is finished by one person, start to end. Small irregularities are a record of that, not a fault." }, visible: true, locked: false },
          { id: "home-banner", type: "imageBanner", props: { heading: "Caring for silver", imageSide: "left", tone: "raised",
            body: "Keep it dry, keep it dark, and wear it often — skin does more for a patina than any polish." }, visible: true, locked: false },
          { id: "home-testimonials", type: "testimonials", props: { layout: "single", items: [
            { quote: "I bought the thin band for my wedding and haven't taken it off since.", name: "Meera S." },
          ] }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { tone: "surface" }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 3, imageRatio: "square", cardStyle: "bordered", align: "center" }),
      aboutPage("The house", "Who makes this, where, and how long they have been doing it.\n\nProvenance is most of the value in this trade. Say it plainly."),
      contactPage(),
      ...policyPages(),
    ],
  }),
};

/* ── proof ──────────────────────────────────────────────────────────────────
 * Bakery and food. Cream and friendly, product-forward, pre-orders and
 * delivery areas answered before anyone has to ask.
 */
const proof: Template = {
  id: "proof",
  name: "Proof",
  blurb: "Warm and appetising, for bakes, preserves and pre-orders.",
  industries: ["bakery", "gifts", "other"],
  swatches: ["#fff9ef", "#3d2b1f", "#d2691e", "#7d9d6d"],
  theme: {
    colors: {
      background: "#fff9ef", surface: "#ffffff", raised: "#fdf0dc",
      text: "#3d2b1f", muted: "#7a6a5c", border: "#efe0c9",
      primary: "#c25e1a", onPrimary: "#ffffff", accent: "#7d9d6d",
    },
    typography: {
      heading: "fraunces", body: "dmsans", scale: 1.05,
      headingWeight: 600, headingTracking: -0.02, headingTransform: "none",
    },
    shape: { radius: 18, buttonRadius: 999, sectionSpacing: 80, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION,
    templateId: "proof",
    theme: proof.theme,
    nav: nav([["Order", "/shop"], ["About", "/about"], ["Find us", "/contact"]]),
    footerNav: nav([["Order", "/shop"], ["Delivery", "/shipping-policy"], ["Contact", "/contact"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: { announcement: "Pre-orders close Thursday for weekend collection" }, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Baked this morning", layout: "split", height: "compact",
            eyebrow: "Order for the weekend", body: "Small-batch bakes, made the night before and collected warm.",
            ctaLabel: "See this week's menu", ctaHref: "/shop", secondaryLabel: "Custom cakes", secondaryHref: "/contact",
          }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "This week", limit: 6, columns: 3, imageRatio: "landscape", cardStyle: "elevated", tone: "page" }, visible: true, locked: false },
          { id: "home-features", type: "featureList", props: { heading: "How it works", columns: 3, align: "center", tone: "raised", items: [
            { title: "Order by Thursday", body: "We bake to order, so we need a little notice." },
            { title: "Collect or deliver", body: "Pick up from the kitchen, or delivery within 8km." },
            { title: "Tell us about allergies", body: "Add a note at checkout and we'll work around it." },
          ] }, visible: true, locked: false },
          { id: "home-faq", type: "faq", props: { heading: "Good to know", items: [
            { question: "Do you deliver?", answer: "Within 8km, for orders over ₹800. Everything else is collection from the kitchen between 9am and 2pm." },
            { question: "Can you do custom cakes?", answer: "Yes — message us with the date, the number of people and any allergies, and we'll quote." },
          ] }, visible: true, locked: false },
          { id: "home-contact", type: "contact", props: { heading: "Ordering something special?", body: "Birthdays, weddings and anything with a candle in it." }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: { blurb: "Baked fresh, in small batches." }, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 3, imageRatio: "landscape", cardStyle: "elevated" }),
      aboutPage("About", "Who bakes, where, and since when.\n\nFood is bought on trust. A photograph of the actual kitchen does more than any adjective."),
      contactPage(),
      ...policyPages(),
    ],
  }),
};

/* ── parcel ─────────────────────────────────────────────────────────────────
 * Digital products. No shipping, no stock — so the page answers "what exactly
 * do I get and when" immediately, and leans on FAQ and reassurance.
 */
const parcel: Template = {
  id: "parcel",
  name: "Parcel",
  blurb: "Clean and direct, for downloads, templates and courses.",
  industries: ["digital", "other"],
  swatches: ["#ffffff", "#10131a", "#3b5bdb", "#eef1f8"],
  theme: {
    colors: {
      background: "#ffffff", surface: "#ffffff", raised: "#f2f4fa",
      text: "#10131a", muted: "#5f6779", border: "#e2e6f0",
      primary: "#3b5bdb", onPrimary: "#ffffff", accent: "#3b5bdb",
    },
    typography: {
      heading: "spacegrotesk", body: "inter", scale: 1,
      headingWeight: 600, headingTracking: -0.03, headingTransform: "none",
    },
    shape: { radius: 10, buttonRadius: 8, sectionSpacing: 76, borderWidth: 1 },
  },
  build: (seed) => ({
    schemaVersion: SCHEMA_VERSION,
    templateId: "parcel",
    theme: parcel.theme,
    nav: nav([["Products", "/shop"], ["FAQ", "/about"], ["Support", "/contact"]]),
    footerNav: nav([["Products", "/shop"], ["Refunds", "/refund-policy"], ["Terms", "/terms"]]),
    settings: baseSettings(seed),
    pages: [
      {
        id: "home", slug: "", title: "Home", system: "home", hidden: false,
        seo: { noindex: false, title: seed.storeName, description: seed.tagline },
        sections: [
          { id: "home-header", type: "header", props: {}, visible: true, locked: true },
          { id: "home-hero", type: "hero", props: {
            heading: seed.tagline || "Download it in a minute", layout: "minimal", align: "center", height: "compact",
            eyebrow: "Instant access", body: "Buy once, download straight away, keep it forever.",
            ctaLabel: "Browse products", ctaHref: "/shop",
          }, visible: true, locked: false },
          { id: "home-features", type: "featureList", props: { columns: 3, align: "center", tone: "raised", items: [
            { title: "Instant delivery", body: "The download link is on the confirmation page and in your email." },
            { title: "Free updates", body: "Buy version one, get every version after it." },
            { title: "Refund within 14 days", body: "If it isn't what you expected, say so and we'll refund it." },
          ] }, visible: true, locked: false },
          { id: "home-grid", type: "productGrid", props: { heading: "Products", limit: 4, columns: 2, imageRatio: "landscape", cardStyle: "bordered", tone: "page" }, visible: true, locked: false },
          { id: "home-faq", type: "faq", props: { heading: "Questions", items: [
            { question: "What format is it in?", answer: "Say exactly which files are included and what software opens them. Vagueness here is the single biggest cause of refund requests." },
            { question: "Can I use it commercially?", answer: "Spell out the licence in plain words. 'Personal and commercial use, no resale of the file itself' is clearer than a legal paragraph." },
          ] }, visible: true, locked: false },
          { id: "home-newsletter", type: "newsletter", props: { heading: "New releases", body: "Occasional email when something new lands." }, visible: true, locked: false },
          { id: "home-footer", type: "footer", props: {}, visible: true, locked: true },
        ],
      },
      shopPage({ columns: 2, imageRatio: "landscape", cardStyle: "bordered" }),
      aboutPage("FAQ", "Licensing, formats, updates and support.\n\nThe more precisely you answer these, the fewer refunds you process."),
      contactPage(),
      ...policyPages(),
    ],
  }),
};

function baseSettings(seed: TemplateSeed) {
  return {
    storeName: seed.storeName,
    tagline: seed.tagline,
    logoUrl: null,
    socials: { instagram: "", whatsapp: "", email: "", phone: "" },
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

import { MORE_TEMPLATES } from "./definitions-two";

export const TEMPLATES: Template[] = [
  thread,
  leaflet,
  cutline,
  facet,
  proof,
  parcel,
  ...MORE_TEMPLATES,
];
