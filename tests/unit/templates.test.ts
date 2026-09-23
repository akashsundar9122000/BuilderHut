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
