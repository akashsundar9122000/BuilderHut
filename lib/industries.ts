/*
 * The trades BuilderHut is for, from blueprint section 4.4.
 *
 * This list drives onboarding, template recommendations, demo seed data and the
 * platform admin's industry breakdown, so it lives in one place rather than
 * being retyped per surface. `id` is persisted on tenants.industry — renaming
 * one is a migration, so treat them as stable.
 */

export interface Industry {
  id: string;
  label: string;
  /** Shown on the onboarding card. Concrete, in the merchant's own words. */
  blurb: string;
  /** Templates designed for this trade, best fit first. */
  templates: string[];
}

export const INDUSTRIES: Industry[] = [
  { id: "crochet", label: "Crochet & Yarn", blurb: "Flowers, amigurumi, blankets, gifts", templates: ["thread"] },
  { id: "handmade", label: "Handmade & Crafts", blurb: "Anything made by hand, in small batches", templates: ["thread"] },
  { id: "invitations", label: "Invitations & Printing", blurb: "Wedding cards, stationery, custom print", templates: ["leaflet"] },
  { id: "clothing", label: "Clothing & T-Shirts", blurb: "Streetwear, prints, small labels", templates: ["cutline"] },
  { id: "jewellery", label: "Jewellery", blurb: "Silver, beadwork, fine and costume", templates: ["facet"] },
  { id: "beauty", label: "Beauty & Skincare", blurb: "Soaps, oils, balms, cosmetics", templates: ["facet"] },
  { id: "bakery", label: "Food & Bakery", blurb: "Cakes, bakes, preserves, pre-orders", templates: ["proof"] },
  { id: "decor", label: "Home Decor", blurb: "Candles, ceramics, textiles, furniture", templates: ["thread"] },
  { id: "art", label: "Art & Paintings", blurb: "Originals, prints, commissions", templates: ["leaflet"] },
  { id: "digital", label: "Digital Products", blurb: "Templates, presets, ebooks, courses", templates: ["parcel"] },
  { id: "gifts", label: "Gifts & Hampers", blurb: "Curated boxes, festive sets", templates: ["thread"] },
  { id: "electronics", label: "Electronics", blurb: "Accessories, gadgets, repairs", templates: ["cutline"] },
  { id: "other", label: "Something else", blurb: "Tell us later — start from anywhere", templates: ["thread"] },
];

export const INDUSTRY_IDS = INDUSTRIES.map((i) => i.id);

export function industryById(id: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.id === id);
}

/** How the merchant reaches customers today. Shapes which features we surface first. */
export const SALES_CHANNELS = [
  { id: "instagram", label: "Instagram" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "offline", label: "A physical shop or stall" },
  { id: "website", label: "An existing website" },
  { id: "new", label: "Nowhere yet — this is new" },
] as const;

/** What they actually want to end up with. Not every merchant wants a checkout. */
export const STORE_GOALS = [
  { id: "full", label: "A full online shop", blurb: "Browse, cart, checkout, payment" },
  { id: "catalog", label: "A catalogue", blurb: "Show what I make; orders come by chat" },
  { id: "enquiry", label: "Portfolio and enquiries", blurb: "Custom work, quoted per order" },
  { id: "bookings", label: "Bookings and services", blurb: "Appointments rather than products" },
] as const;

export type SalesChannel = (typeof SALES_CHANNELS)[number]["id"];
export type StoreGoal = (typeof STORE_GOALS)[number]["id"];
