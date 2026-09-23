import { describe, expect, it } from "vitest";
import { SiteDocumentSchema } from "@/lib/schema/page";
import { REGISTRY } from "@/lib/render/registry";
import { buildDocument, TEMPLATES, templatesForIndustry } from "@/lib/templates";
import { INDUSTRIES } from "@/lib/industries";

const seed = { storeName: "Thread & Bloom", tagline: "Made slowly", industry: "crochet" };

describe.each(TEMPLATES.map((t) => [t.id, t] as const))("template: %s", (id, template) => {
  const doc = buildDocument(id, seed);

  it("produces a document that validates", () => {
    expect(() => SiteDocumentSchema.parse(template.build(seed))).not.toThrow();
  });

  it("uses only registered section types", () => {
    // A type not in the registry would render as nothing on a live storefront.
    for (const page of doc.pages) {
      for (const section of page.sections) {
        expect(REGISTRY[section.type], `${page.slug || "home"} → ${section.type}`).toBeDefined();
      }
    }
  });

  it("has every section's props satisfy that section's own schema", () => {
    for (const page of doc.pages) {
      for (const section of page.sections) {
        const result = REGISTRY[section.type].schema.safeParse(section.props);
        expect(result.success, `${page.slug || "home"} → ${section.id}`).toBe(true);
      }
    }
  });

  it("has a home page, a shop page and the policy pages", () => {
    expect(doc.pages.some((p) => p.system === "home")).toBe(true);
    expect(doc.pages.some((p) => p.system === "shop")).toBe(true);
    for (const slug of ["shipping-policy", "refund-policy", "privacy-policy", "terms"]) {
      expect(doc.pages.some((p) => p.slug === slug), slug).toBe(true);
    }
  });

  it("opens with a header and closes with a footer on every page", () => {
    for (const page of doc.pages) {
      expect(page.sections[0]?.type, page.slug || "home").toBe("header");
      expect(page.sections.at(-1)?.type, page.slug || "home").toBe("footer");
    }
  });

  it("carries the store name through", () => {
    expect(doc.settings.storeName).toBe(seed.storeName);
  });

  it("has unique section ids within each page", () => {
    for (const page of doc.pages) {
      const ids = page.sections.map((s) => s.id);
      expect(new Set(ids).size, `${page.slug || "home"} has duplicate section ids`).toBe(ids.length);
    }
  });
});

describe("the set of templates", () => {
  it("has unique ids", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
   * Blueprint section 0.1: storefronts must not all look alike. These assertions
   * are the mechanical part of that — they cannot judge taste, but they can
   * catch the failure mode where a template is a copy with a new palette.
   */
  it("gives every template a distinct palette", () => {
    const primaries = TEMPLATES.map((t) => t.theme.colors.primary);
    expect(new Set(primaries).size).toBe(primaries.length);
  });

  it("gives every template a distinct type pairing", () => {
    const pairs = TEMPLATES.map((t) => `${t.theme.typography.heading}/${t.theme.typography.body}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("varies shape, not only colour", () => {
    // A bakery at radius 18 and a streetwear label at radius 0 are different
    // products. Every template sharing one radius would mean they are not.
    const radii = new Set(TEMPLATES.map((t) => t.theme.shape.radius));
    expect(radii.size).toBeGreaterThanOrEqual(4);
  });

  it("varies composition, not only style", () => {
    // Compare the ordered list of section types on each home page.
    const shapes = TEMPLATES.map((t) =>
      buildDocument(t.id, seed)
        .pages.find((p) => p.system === "home")!
        .sections.map((s) => s.type)
        .join(">"),
    );
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("recommends at least one template for every industry offered at onboarding", () => {
    for (const industry of INDUSTRIES) {
      const recommended = templatesForIndustry(industry.id);
      expect(recommended.length, industry.id).toBeGreaterThan(0);
      // The first must genuinely be designed for that trade, not just a fallback.
      expect(recommended[0]!.industries, industry.id).toContain(industry.id);
    }
  });
});

/*
 * Distinct primaries are not enough on their own: Parcel and Circuit once held
 * two blues eight units apart, which passed "unique" and looked like the same
 * template twice on the gallery page. The button colour is the loudest thing on
 * a card, so it has to be distinguishable, not merely different.
 */
function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Low-cost perceptual distance — the "redmean" approximation. */
function colourDistance(a: string, b: string): number {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  const mean = (r1 + r2) / 2;
  return Math.sqrt(
    (2 + mean / 256) * (r1 - r2) ** 2 +
      4 * (g1 - g2) ** 2 +
      (2 + (255 - mean) / 256) * (b1 - b2) ** 2,
  );
}

describe("templates are told apart at a glance", () => {
  it("keeps every pair of button colours perceptibly apart", () => {
    for (let i = 0; i < TEMPLATES.length; i += 1) {
      for (let j = i + 1; j < TEMPLATES.length; j += 1) {
        const a = TEMPLATES[i]!;
        const b = TEMPLATES[j]!;
        const distance = colourDistance(a.theme.colors.primary, b.theme.colors.primary);
        expect(distance, `${a.id} and ${b.id} share a button colour`).toBeGreaterThan(45);
      }
    }
  });

  it("gives every template a distinct product-card treatment or grid shape", () => {
    // Two templates may share a card style, but not a card style AND a column
    // count AND an image ratio — at that point the shop pages are the same page.
    const signatures = TEMPLATES.map((template) => {
      const shop = buildDocument(template.id, seed).pages.find((p) => p.system === "shop")!;
      const grid = shop.sections.find((s) => s.type === "productGrid")!.props;
      return [grid.columns ?? "-", grid.imageRatio ?? "-", grid.cardStyle ?? "-"].join("/");
    });
    expect(new Set(signatures).size, signatures.join(" ")).toBe(signatures.length);
  });
});
