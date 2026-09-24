import { describe, expect, it } from "vitest";

import { withAccountPages } from "@/lib/builder/system-pages";
import { resolveSystemPage } from "@/lib/render/system-page";
import { parseSectionProps } from "@/lib/render/registry";
import { buildDocument } from "@/lib/templates";
import { SiteDocumentSchema, type Page, type SiteDocument } from "@/lib/schema/page";

/*
 * Bringing an old document up to date, and deciding what a system route renders.
 *
 * Both are pure, which is the point: the document-versus-fallback decision that
 * every customer-account route depends on is checked here as data rather than by
 * driving a browser at it.
 */

function docWith(pages: Page[]): SiteDocument {
  const base = buildDocument("thread", { storeName: "Thread & Bloom", tagline: "", industry: "crochet" });
  return { ...base, pages };
}

const homePage: Page = {
  id: "home",
  slug: "",
  title: "Home",
  system: "home",
  hidden: false,
  seo: { noindex: false },
  sections: [
    { id: "home-header", type: "header", props: {}, visible: true, locked: true },
    { id: "home-hero", type: "hero", props: {}, visible: true, locked: false },
    { id: "home-footer", type: "footer", props: {}, visible: true, locked: true },
  ],
};

describe("withAccountPages", () => {
  it("adds the three pages a document is missing", () => {
    const result = withAccountPages(docWith([homePage]));
    expect(result.added).toEqual(["login", "signup", "account"]);
    expect(result.doc.pages).toHaveLength(4);
    for (const system of ["login", "signup", "account"] as const) {
      expect(result.doc.pages.some((page) => page.system === system), system).toBe(true);
    }
  });

  it("is idempotent — twice is the same as once", () => {
    const once = withAccountPages(docWith([homePage]));
    const twice = withAccountPages(once.doc);
    expect(twice.added).toEqual([]);
    expect(twice.adopted).toEqual([]);
    expect(twice.doc).toEqual(once.doc);
  });

  it("leaves a document that already has them completely alone", () => {
    const seeded = withAccountPages(docWith([homePage])).doc;
    // A merchant's own words on their sign-in page.
    const edited: SiteDocument = {
      ...seeded,
      pages: seeded.pages.map((page) =>
        page.system === "login"
          ? { ...page, title: "Members", sections: [...page.sections] }
          : page,
      ),
    };
    const result = withAccountPages(edited);
    expect(result.added).toEqual([]);
    expect(result.doc.pages.find((page) => page.system === "login")?.title).toBe("Members");
  });

  /*
   * The case that would otherwise make a merchant's own page unreachable: the
   * static route would shadow it silently, with no error anywhere to say why.
   */
  it("adopts a page the merchant already wrote at that slug, keeping their sections", () => {
    const theirs: Page = {
      id: "their-login",
      slug: "login",
      title: "Sign in to Thread",
      hidden: false,
      seo: { noindex: false },
      sections: [
        { id: "l-header", type: "header", props: {}, visible: true, locked: true },
        { id: "l-words", type: "richText", props: { body: "Members only." }, visible: true, locked: false },
        { id: "l-footer", type: "footer", props: {}, visible: true, locked: true },
      ],
    };

    const result = withAccountPages(docWith([homePage, theirs]));
    expect(result.adopted).toContain("login");

    const adopted = result.doc.pages.find((page) => page.id === "their-login")!;
    expect(adopted.system).toBe("login");
    expect(adopted.title).toBe("Sign in to Thread");
    // Their own section survives…
    expect(adopted.sections.some((section) => section.id === "l-words")).toBe(true);
    // …and the form lands above the footer rather than after it.
    const types = adopted.sections.map((section) => section.type);
    expect(types.indexOf("accountLogin")).toBeLessThan(types.indexOf("footer"));
    expect(types[types.length - 1]).toBe("footer");
    // And no second page was appended at the same slug.
    expect(result.doc.pages.filter((page) => page.slug === "login")).toHaveLength(1);
  });

  /*
   * A 41-page document fails SiteDocumentSchema, which makes every subsequent
   * saveDraft reject — silently, while the merchant keeps typing.
   */
  it("refuses rather than overflowing a document that is already at the limit", () => {
    const filler: Page[] = Array.from({ length: 39 }, (_, i) => ({
      id: `p${i}`,
      slug: `page-${i}`,
      title: `Page ${i}`,
      hidden: false,
      seo: { noindex: false },
      sections: [{ id: `p${i}-header`, type: "header" as const, props: {}, visible: true, locked: true }],
    }));
    const full = docWith([homePage, ...filler]);
    expect(full.pages).toHaveLength(40);

    const result = withAccountPages(full);
    expect(result.doc.pages).toHaveLength(40);
    expect(result.skipped).toEqual(["login", "signup", "account"]);
    // Still a valid document, which is the whole point.
    expect(SiteDocumentSchema.safeParse(result.doc).success).toBe(true);
  });

  it("produces pages that open with a header and close with a footer", () => {
    const result = withAccountPages(docWith([homePage]));
    for (const page of result.doc.pages) {
      expect(page.sections[0]?.type, page.id).toBe("header");
      expect(page.sections[page.sections.length - 1]?.type, page.id).toBe("footer");
    }
  });

  it("produces a document that still validates", () => {
    const result = withAccountPages(docWith([homePage]));
    expect(SiteDocumentSchema.safeParse(result.doc).success).toBe(true);
  });
});

describe("resolveSystemPage", () => {
  const seeded = withAccountPages(docWith([homePage])).doc;

  it("uses the merchant's page when they have one", () => {
    const resolved = resolveSystemPage(seeded, "login", "accountLogin");
    expect(resolved.kind).toBe("document");
    if (resolved.kind === "document") expect(resolved.page.system).toBe("login");
  });

  /* Every store published before this shipped. */
  it("falls back to the bare section when the document has no such page", () => {
    const resolved = resolveSystemPage(docWith([homePage]), "login", "accountLogin");
    expect(resolved.kind).toBe("fallback");
    if (resolved.kind === "fallback") {
      expect(resolved.section.type).toBe("accountLogin");
      // The registry's own defaults, so the copy has one source rather than two.
      expect(parseSectionProps("accountLogin", resolved.section.props)).not.toBeNull();
      expect(resolved.section.props.heading).toBe("Welcome back");
    }
  });

  /*
   * A page whose form was somehow removed is a dead end — a heading with nothing
   * under it — so it falls back too.
   */
  it("falls back when the page exists but its form is gone", () => {
    const stripped: SiteDocument = {
      ...seeded,
      pages: seeded.pages.map((page) =>
        page.system === "login"
          ? { ...page, sections: page.sections.filter((section) => section.type !== "accountLogin") }
          : page,
      ),
    };
    expect(resolveSystemPage(stripped, "login", "accountLogin").kind).toBe("fallback");
  });
});
