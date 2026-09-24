import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GUIDE_GROUPS, GUIDE_PAGES } from "@/lib/guide/generated";
import { GUIDE_AUDIENCES, GUIDE_NAV, GUIDE_NAV_GROUPS } from "@/lib/guide/nav.generated";

/*
 * Invariants of the generated guide.
 *
 * scripts/build-guide.mjs already fails on a malformed page, so none of this
 * re-checks the compiler. What it checks is the shape of what came out — the
 * things that would ship quietly: a page in no group, a related link to
 * nothing, an engineering page that found its way into the sitemap, the two
 * generated files disagreeing, and a directory name that would shadow the whole
 * route tree.
 */

describe("the generated guide", () => {
  it("has pages", () => {
    // A compiler that silently produced nothing would pass every other test here.
    expect(GUIDE_PAGES.length).toBeGreaterThan(0);
    expect(GUIDE_GROUPS.length).toBeGreaterThan(0);
  });

  it("gives every page a group and an audience that exist", () => {
    for (const page of GUIDE_PAGES) {
      const group = GUIDE_GROUPS.find((g) => g.id === page.group);
      expect(group, `${page.slug} is in group "${page.group}"`).toBeDefined();
      expect(page.audience).toBe(group?.audience);
      expect(GUIDE_AUDIENCES.some((a) => a.id === page.audience)).toBe(true);
    }
  });

  it("keeps slugs unique within a group", () => {
    const seen = new Set<string>();
    for (const page of GUIDE_PAGES) {
      const key = `${page.group}/${page.slug}`;
      expect(seen.has(key), `${key} appears twice`).toBe(false);
      seen.add(key);
    }
  });

  it("resolves every related link", () => {
    for (const page of GUIDE_PAGES) {
      for (const slug of page.related) {
        expect(
          GUIDE_PAGES.some((p) => p.slug === slug),
          `${page.slug} says related: ${slug}`,
        ).toBe(true);
      }
    }
  });

  it("carries no script tag, javascript: URL or inline handler", () => {
    /*
     * The article route renders this HTML with dangerouslySetInnerHTML, which
     * is only defensible because the source is files in this repo. This is the
     * assertion that keeps that claim true — if a page ever gains an inline
     * handler, it should be because somebody deliberately changed the compiler,
     * not because Markdown let one through.
     */
    for (const page of GUIDE_PAGES) {
      expect(page.html, page.slug).not.toMatch(/<script/i);
      expect(page.html, page.slug).not.toMatch(/javascript:/i);
      expect(page.html, page.slug).not.toMatch(/\son[a-z]+\s*=/i);
    }
  });

  it("gives every heading in the table of contents an anchor in the HTML", () => {
    for (const page of GUIDE_PAGES) {
      for (const heading of page.toc) {
        expect(page.html, `${page.slug} → #${heading.id}`).toContain(`id="${heading.id}"`);
      }
    }
  });
});

describe("the two generated files", () => {
  /*
   * generated.ts is server-only and nav.generated.ts is the client-safe index.
   * They are written by one pass over one source, so they can only disagree if
   * somebody edits one by hand — which is exactly the edit this catches.
   */
  it("describe the same pages", () => {
    expect(GUIDE_NAV.length).toBe(GUIDE_PAGES.length);

    for (const page of GUIDE_PAGES) {
      const nav = GUIDE_NAV.find((n) => n.group === page.group && n.slug === page.slug);
      expect(nav, `${page.group}/${page.slug} is missing from the nav index`).toBeDefined();
      expect(nav?.title).toBe(page.title);
      expect(nav?.summary).toBe(page.summary);
      expect(nav?.audience).toBe(page.audience);
      expect(nav?.order).toBe(page.order);
    }
  });

  it("describe the same groups", () => {
    expect(GUIDE_NAV_GROUPS.map((g) => g.id)).toEqual(GUIDE_GROUPS.map((g) => g.id));
  });

  it("keeps the nav index free of rendered HTML", () => {
    // The whole reason for the split: this is what a client chunk may carry.
    expect(JSON.stringify(GUIDE_NAV)).not.toContain("<");
  });
});

describe("what a search engine is told", () => {
  const engineering = GUIDE_PAGES.filter((page) => page.audience === "engineering");

  it("marks every engineering page noindex", () => {
    expect(engineering.length).toBeGreaterThan(0);
    for (const page of engineering) expect(page.noindex, page.slug).toBe(true);
  });

  it("keeps them out of the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const page of engineering) {
      expect(urls.some((url) => url.endsWith(`/guide/${page.group}/${page.slug}`))).toBe(false);
    }
  });

  it("disallows them in robots.txt", () => {
    const rules = robots().rules;
    const disallow = Array.isArray(rules) ? [] : [rules.disallow ?? []].flat();
    for (const page of engineering) {
      expect(
        disallow.some((prefix) => `/guide/${page.group}`.startsWith(String(prefix))),
        `/guide/${page.group} is not disallowed`,
      ).toBe(true);
    }
  });

  it("lists every public page", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const page of GUIDE_PAGES.filter((p) => !p.noindex)) {
      expect(urls.some((url) => url.endsWith(`/guide/${page.group}/${page.slug}`)), page.slug).toBe(
        true,
      );
    }
  });
});

describe("the screenshots directory", () => {
  it("is not called public/guide", () => {
    /*
     * A file at public/guide/… is served ahead of the app/(marketing)/guide
     * route tree and would shadow the entire guide — silently, and only once
     * the first screenshot was committed. Hence public/guide-shots.
     */
    expect(existsSync(path.join(process.cwd(), "public", "guide"))).toBe(false);
  });
});
