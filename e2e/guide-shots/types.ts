import type { Locator, Page } from "@playwright/test";

/** Which session a shot is taken in. All three are produced by one capture run. */
export type Persona = "anon" | "merchant" | "shopper";

export type Device = "desktop" | "phone";
export type Theme = "light" | "dark";

/** Context created by the run itself — the slug and the ids do not exist before it. */
export type Journey = {
  email: string;
  storeName: string;
  slug: string;
  productId: string;
  productSlug: string;
  orderId: string;
};

export type Shot = {
  /** kebab-case, unique. The markdown says ![alt](shot:<id> "caption"). */
  id: string;

  /**
   * A function, not a string, because the slug and the order id are made by the
   * run. There is no route here that exists before the journey has created it.
   */
  path: string | ((j: Journey) => string);

  persona?: Persona;

  /** Text only the intended screen renders — proof a guard did not redirect. */
  waitFor?: string | RegExp;

  /** Opens a panel, switches a tab, focuses a field. NEVER submits. */
  prepare?: (page: Page, device: Device) => Promise<void>;

  /** Crop to one element rather than the viewport. */
  element?: (page: Page) => Locator;

  /**
   * Phone is opt-in, the reverse of the reference implementations.
   *
   * Only where the layout genuinely differs — the builder's panels become
   * sheets, the dashboard's sidebar becomes a bottom bar. Everywhere else a
   * phone shot is the same screen in a narrower box: bytes, and nothing taught.
   */
  devices?: Device[];

  /**
   * Storefront screens render the MERCHANT's palette and deliberately ignore
   * BuilderHut's theme — app/(storefront)/s/[slug]/layout.tsx says so in its
   * own comment. A light and a dark capture of one would be byte-identical, so
   * they declare ["light"] and the renderer falls back for the dark slot.
   */
  themes?: Theme[];

  /** Viewport height, for framing. Never fullPage: a 1440x6000 image is unreadable in prose. */
  height?: number;

  /** Anything irreducibly unstable — a verification code, a domain token. */
  mask?: (page: Page) => Locator[];
};
