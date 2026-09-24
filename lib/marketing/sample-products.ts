import type { ProductCard } from "@/lib/render/context";

/*
 * Stand-in products for the public template previews.
 *
 * A template preview has no shop behind it, and a product grid with nothing in
 * it shows none of what the template does with a product grid — which is most
 * of what distinguishes one template from another.
 *
 * Two rules. The names are chosen per trade, because "Product 1" in a bakery
 * template tells you nothing about whether the bakery template is any good.
 * And `imageUrl` is null throughout: the renderer draws its own placeholder,
 * which is the honest thing to show for a shop that does not exist. Stock
 * photography here would be selling somebody else's pictures as the product.
 */

const BY_INDUSTRY: Record<string, [string, number][]> = {
  crochet: [["Granny square throw", 289900], ["Bucket hat", 99900], ["Amigurumi bear", 74900]],
  handmade: [["Stoneware mug", 89000], ["Linen apron", 165000], ["Cedar spoon", 42000]],
  bakery: [["Sourdough loaf", 22000], ["Almond croissant", 9000], ["Celebration cake", 285000]],
  invitations: [["Letterpress suite", 480000], ["Save the date", 12000], ["Menu cards, set of 10", 95000]],
  jewellery: [["Silver hoop earrings", 320000], ["Signet ring", 745000], ["Fine chain", 415000]],
  clothing: [["Heavyweight tee", 149900], ["Boxy overshirt", 389900], ["Cotton cap", 89900]],
  art: [["Giclée print, A3", 250000], ["Original study", 1450000], ["Sketchbook", 68000]],
  beauty: [["Rosehip face oil", 165000], ["Oat soap bar", 45000], ["Lip balm", 32000]],
  decor: [["Beeswax pillar", 78000], ["Ceramic planter", 142000], ["Woven runner", 235000]],
  gifts: [["The little hamper", 195000], ["Tea and biscuits box", 145000], ["Gift card", 100000]],
  electronics: [["USB-C hub, 7 port", 429900], ["Mechanical keyboard", 899900], ["Braided cable, 2m", 79900]],
  digital: [["Brand kit template", 249900], ["Lightroom presets", 129900], ["Six-week course", 999900]],
};

const FALLBACK: [string, number][] = [
  ["Everyday piece", 189000],
  ["The small one", 94000],
  ["Gift box", 275000],
];

export function sampleProducts(industries: readonly string[]): ProductCard[] {
  const trade = industries.find((i) => i !== "other" && i in BY_INDUSTRY);
  const rows = trade ? BY_INDUSTRY[trade]! : FALLBACK;

  return rows.map(([name, priceMinor], i) => ({
    id: `sample-${i}`,
    name,
    slug: `sample-${i}`,
    priceMinor,
    compareAtMinor: null,
    currency: "INR",
    imageUrl: null,
  }));
}
