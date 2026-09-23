import type { SiteDocument } from "@/lib/schema/page";

/** A product as a storefront section needs it — never the whole database row. */
export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  priceMinor: bigint | number;
  compareAtMinor: bigint | number | null;
  currency: string;
  imageUrl: string | null;
  soldOut?: boolean;
}

/**
 * Everything a section may read. Passed down rather than fetched per section,
 * so one page render is one set of queries instead of N.
 */
export interface RenderContext {
  doc: SiteDocument;
  /** Base path for internal links: "/s/thread-bloom" or "" on a custom domain. */
  base: string;
  products: ProductCard[];
  /** True inside the builder canvas: suppresses navigation and real form posts. */
  editing: boolean;
}

export function linkTo(ctx: RenderContext, path: string): string {
  if (/^https?:|^mailto:|^tel:/.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${ctx.base}${clean === "/" ? "" : clean}` || "/";
}
