import type { Shot } from "./types";

/*
 * Every screenshot the guide can use.
 *
 * A shot is declared here and referenced from Markdown as shot:<id>. The two
 * are reconciled by scripts/check-guide-shots.mjs: a picture the guide asks for
 * and nobody has told the capture script how to take is a build failure, which
 * is the drift that actually happens.
 *
 * Ordered by where they appear in the journey, because that is also the order
 * the capture script can reach them in.
 */
export const SHOTS: Shot[] = [
  /* ── public ─────────────────────────────────────────────────────────── */
  { id: "marketing-home", path: "/", persona: "anon", height: 900 },
  { id: "templates-gallery", path: "/templates", persona: "anon", waitFor: /template/i },
  { id: "signup", path: "/signup", persona: "anon", waitFor: /Create/i },
  { id: "login", path: "/login", persona: "anon" },

  /* ── the dashboard ──────────────────────────────────────────────────── */
  {
    id: "dashboard",
    path: "/app",
    persona: "merchant",
    // The bottom bar replaces the sidebar below lg, and it is the only
    // navigation a merchant has on a phone.
    devices: ["desktop", "phone"],
    height: 900,
  },
  { id: "products-list", path: "/app/products", persona: "merchant", waitFor: /product/i },
  { id: "product-new", path: "/app/products/new", persona: "merchant", waitFor: /Name/ },
  {
    id: "product-images",
    path: (j) => `/app/products/${j.productId}`,
    persona: "merchant",
    waitFor: /Pictures|picture/i,
  },
  { id: "orders-list", path: "/app/orders", persona: "merchant" },
  {
    id: "order-detail",
    path: (j) => `/app/orders/${j.orderId}`,
    persona: "merchant",
    height: 950,
  },
  { id: "customers", path: "/app/customers", persona: "merchant" },
  { id: "analytics", path: "/app/analytics", persona: "merchant", height: 900 },
  { id: "discounts", path: "/app/discounts", persona: "merchant" },
  { id: "shipping", path: "/app/shipping", persona: "merchant" },
  { id: "taxes", path: "/app/taxes", persona: "merchant" },
  { id: "domains", path: "/app/domains", persona: "merchant" },
  { id: "team", path: "/app/team", persona: "merchant" },
  { id: "plan", path: "/app/plan", persona: "merchant", height: 900 },
  { id: "settings", path: "/app/settings", persona: "merchant", height: 900 },

  /* ── the builder ────────────────────────────────────────────────────── */
  { id: "builder-three-columns", path: "/app/builder", persona: "merchant", height: 900 },
  {
    id: "builder-add",
    path: "/app/builder",
    persona: "merchant",
    prepare: (page) => page.getByRole("tab", { name: "Add" }).click().catch(() => {}),
    height: 900,
  },
  {
    id: "builder-layers",
    path: "/app/builder",
    persona: "merchant",
    prepare: (page) => page.getByRole("tab", { name: "Layers" }).click().catch(() => {}),
    height: 900,
  },
  {
    id: "builder-pages",
    path: "/app/builder",
    persona: "merchant",
    prepare: (page) => page.getByRole("tab", { name: "Pages" }).click().catch(() => {}),
    height: 900,
  },
  {
    id: "builder-panels-phone",
    path: "/app/builder",
    persona: "merchant",
    // On a phone the side panels are sheets over a full-screen canvas, which is
    // a genuinely different arrangement rather than a narrower one.
    devices: ["phone"],
  },
  {
    id: "builder-versions",
    path: "/app/builder",
    persona: "merchant",
    prepare: async (page) => {
      await page.getByRole("button", { name: /History|Versions/i }).first().click();
      await page.waitForTimeout(800);
    },
    height: 900,
  },
  {
    id: "publish-readiness",
    path: "/app/builder",
    persona: "merchant",
    // The readiness report is a panel, not a route: it exists only once Publish
    // has been pressed, and pressing it does not publish anything by itself.
    prepare: async (page) => {
      await page.getByRole("button", { name: "Publish" }).first().click();
      await page.waitForTimeout(1200);
    },
    height: 900,
  },
  { id: "builder-preview", path: "/app/builder/preview", persona: "merchant", height: 900 },

  /* ── the shop a customer sees ───────────────────────────────────────── */
  {
    id: "storefront-home",
    path: (j) => `/s/${j.slug}`,
    persona: "shopper",
    themes: ["light"],
    devices: ["desktop", "phone"],
    height: 900,
  },
  {
    id: "storefront-product",
    path: (j) => `/s/${j.slug}/p/${j.productSlug}`,
    persona: "shopper",
    themes: ["light"],
    height: 900,
  },
  {
    id: "storefront-cart",
    path: (j) => `/s/${j.slug}/cart`,
    persona: "shopper",
    themes: ["light"],
  },
  {
    id: "storefront-checkout",
    path: (j) => `/s/${j.slug}/checkout`,
    persona: "shopper",
    themes: ["light"],
    height: 950,
  },
];

/* Invariants worth failing the import over rather than debugging in a picture. */
const seen = new Set<string>();
for (const shot of SHOTS) {
  if (seen.has(shot.id)) throw new Error(`Duplicate shot id: ${shot.id}`);
  if (!/^[a-z0-9-]+$/.test(shot.id)) throw new Error(`Shot id is not kebab-case: ${shot.id}`);
  seen.add(shot.id);
}

export const SHOT_IDS = [...seen];
export type { Shot } from "./types";
