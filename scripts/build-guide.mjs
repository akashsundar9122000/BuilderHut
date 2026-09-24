#!/usr/bin/env node
/**
 * Builds the guide.
 *
 *   docs/guide/<group>/<NNN>-<slug>.md   authored Markdown
 *        │
 *        ▼
 *   lib/guide/generated.ts               full pages, HTML included. Server only.
 *   lib/guide/nav.generated.ts           titles and headings only. Safe in a client chunk.
 *
 * Markdown becomes HTML here, at build time, rather than in the app. That keeps
 * `marked` a devDependency, keeps every /guide route a plain prerendered server
 * component with no filesystem access, and means nothing a merchant, a staff
 * member or a shopper typed can ever reach a Markdown parser.
 *
 * Both outputs are committed. `pnpm check:guide` regenerates them and diffs, so
 * a page edited without a rebuild fails the gate rather than shipping a guide
 * that quietly serves last week's words.
 *
 * Why two files. The sidebar and its search are a client island, and a client
 * island that imported the full module would drag every page's HTML into a
 * client chunk — roughly 400 KB against a 1200 KB budget. generated.ts opens
 * with `import "server-only"` so that mistake is a build error naming the file;
 * nav.generated.ts carries titles, summaries and heading text and nothing else.
 *
 * Screenshots are not read from here beyond the manifest. They live in
 * public/guide-shots/ — NOT public/guide/, which Next would serve in front of
 * the /guide route and shadow the entire guide.
 */
import { Marked } from "marked";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: pathname hands back a percent-encoded path
// for any directory containing a space, and every lookup then silently misses
// and the build reports zero pages rather than failing. Cheap insurance.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "docs", "guide");
const SHOTS = path.join(ROOT, "public", "guide-shots");
const VIDEOS = path.join(ROOT, "public", "guide-video");
const VIDEO_MANIFEST = path.join(VIDEOS, "manifest.json");
const MANIFEST = path.join(SHOTS, "manifest.json");
const OPENAPI = path.join(ROOT, "public", "openapi.json");
const OUT_FULL = path.join(ROOT, "lib", "guide", "generated.ts");
const OUT_NAV = path.join(ROOT, "lib", "guide", "nav.generated.ts");

/**
 * The three audiences.
 *
 * `noindex` keeps a whole audience out of the sitemap and into robots.txt's
 * disallow list. The engineering guide is not secret — it is a map of this
 * repo, and anyone with the link may read it — but it is noise in a search
 * result for a merchant looking up how to add a product.
 */
export const AUDIENCES = [
  { id: "merchant", label: "Using BuilderHut", blurb: "For the person running the shop.", noindex: false },
  { id: "integrator", label: "API and MCP", blurb: "For building against BuilderHut.", noindex: false },
  { id: "engineering", label: "How it is built", blurb: "For working on BuilderHut itself.", noindex: true },
];

/**
 * The groups, in reading order.
 *
 * Audience is a property of the GROUP, not of a page. A page's audience is a
 * fact about where it is shelved, and a per-page override is exactly how one
 * engineering page ends up in the sitemap. The only per-page escape is
 * `noindex: true` in front matter, which can make a page less visible than its
 * group and never more.
 */
export const GROUPS = [
  {
    id: "start",
    audience: "merchant",
    title: "Start here",
    blurb: "What BuilderHut is, getting an account, and finding your way around.",
  },
  {
    id: "setup",
    audience: "merchant",
    title: "Setting up your shop",
    blurb: "The questions at the start, choosing a template, and your shop's address.",
  },
  {
    id: "selling",
    audience: "merchant",
    title: "What you sell",
    blurb: "Products, pictures, prices, delivery, tax and discount codes.",
  },
  {
    id: "builder",
    audience: "merchant",
    title: "The builder",
    blurb: "Sections, the settings panel, style, previewing and publishing.",
  },
  {
    id: "running",
    audience: "merchant",
    title: "Running the shop",
    blurb: "Orders, refunds, customers, the numbers, your domain, your team and your plan.",
  },
  {
    id: "help",
    audience: "merchant",
    title: "Help",
    blurb: "How do I, what to do when something looks wrong, and what the words mean.",
  },

  {
    id: "api",
    audience: "integrator",
    title: "REST API",
    blurb: "Tokens, conventions, errors, rate limits, and every endpoint.",
  },
  {
    id: "mcp",
    audience: "integrator",
    title: "MCP",
    blurb: "Connecting an assistant to a shop, and the tools it gets.",
  },

  {
    id: "engineering",
    audience: "engineering",
    title: "How it is built",
    blurb: "Architecture, tenancy, the document model, the render pipeline and the gates.",
  },
];

const AUDIENCE_IDS = new Set(AUDIENCES.map((a) => a.id));
for (const g of GROUPS) {
  if (!AUDIENCE_IDS.has(g.audience)) throw new Error(`group ${g.id}: unknown audience ${g.audience}`);
}

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, "")
    .replace(/[`'’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "section";

const strip = (html) =>
  html
    .replace(/<pre[\s\S]*?<\/pre>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const list = (v) =>
  v
    ? String(v)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

/** Front matter keys that are derived from the file's path instead. */
const BANNED = ["group", "order", "slug", "audience"];

function frontMatter(raw, file) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  for (const key of BANNED) {
    if (key in meta) {
      throw new Error(
        `${file}: "${key}" comes from the file's path, not its front matter. ` +
          `Two places to record it is one place that eventually lies.`,
      );
    }
  }
  return { meta, body: raw.slice(m[0].length) };
}

/* ------------------------------------------------------------------ markdown */

function uniqueId(ctx, id) {
  let out = id;
  let n = 2;
  while (ctx.ids.has(out)) out = `${id}-${n++}`;
  ctx.ids.add(out);
  return out;
}

const shotManifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const videoManifest = fs.existsSync(VIDEO_MANIFEST)
  ? JSON.parse(fs.readFileSync(VIDEO_MANIFEST, "utf8"))
  : {};

/**
 * One screenshot, in up to four variants.
 *
 * Both themes go into the markup and CSS picks between them on [data-theme],
 * so the reader's own toggle swaps every picture on the page with it. A media
 * query would not: somebody on a dark OS who pressed "light" would get light
 * chrome around dark screenshots.
 *
 * Width and height come from the manifest the capture script writes, so the
 * box is reserved before any bytes arrive and a theme swap cannot reflow the
 * page under the reader's cursor.
 *
 * `themes` lets a shot be captured once. Storefront screens render the
 * merchant's own palette and deliberately ignore BuilderHut's theme, so a
 * light and a dark capture of one would be byte-identical — the light one is
 * shown to both, rather than shipping an empty <picture>.
 *
 * A shot that was never captured renders as a visible gap, never a broken
 * image: a partial capture must not read as a complete one.
 */
/*
 * An inline recording, written in Markdown the same way a screenshot is:
 *
 *   ![alt](video:builderhut-demo "caption")
 *
 * Plays in the page rather than linking out. No autoplay and no loop: this is
 * eleven minutes of narration, and a page that starts talking at somebody who
 * came to read is a page they close. preload="metadata" fetches a few KB for the
 * duration and scrubber, not the twelve megabytes behind it — the file is only
 * downloaded once a reader presses play.
 *
 * The subtitle track is the same WebVTT the mixer wrote from the narration, so
 * the words are available muted, in a noisy room, or to anyone who cannot hear
 * them. A recording that only works with sound is a recording half the readers
 * cannot use.
 */
function video(ctx, id, alt, caption) {
  const meta = videoManifest[id];
  const file = meta && path.join(VIDEOS, `${id}.mp4`);

  if (!meta || !fs.existsSync(file)) {
    ctx.missingVideos.push(id);
    return (
      `<figure class="gd-video gd-video-missing">` +
      `<div class="gd-missing">Recording &ldquo;${esc(id)}&rdquo; has not been captured yet</div>` +
      `${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`
    );
  }

  ctx.videos.push(id);
  const poster = meta.poster ? ` poster="/guide-video/${esc(meta.poster)}"` : "";
  const track = meta.captions
    ? `<track kind="captions" srclang="en" label="English" src="/guide-video/${esc(meta.captions)}" default>`
    : "";

  return (
    `<figure class="gd-video">` +
    `<video controls playsinline preload="metadata"${poster} ` +
    `width="${meta.w}" height="${meta.h}" aria-label="${esc(alt)}">` +
    `<source src="/guide-video/${esc(id)}.mp4" type="video/mp4">` +
    `${track}` +
    `<p>Your browser cannot play this recording. ` +
    `<a href="/guide-video/${esc(id)}.mp4">Download it instead</a>.</p>` +
    `</video>` +
    `${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`
  );
}

function shot(ctx, id, alt, caption) {
  const meta = shotManifest[id];
  /*
   * A shot may be phone-only — the builder's panels are sheets there and
   * columns everywhere else, so a desktop capture of that id would be a
   * picture of something the page is not describing. Whichever size exists is
   * the one the <img> points at.
   */
  const primary = meta && (meta.desktop ? "desktop" : meta.phone ? "phone" : null);
  const probe =
    primary && path.join(SHOTS, `${id}--${primary}--${meta.themes?.[0] ?? "light"}.webp`);

  if (!meta || !primary || !fs.existsSync(probe)) {
    ctx.missingShots.push(id);
    return (
      `<figure class="gd-shot gd-shot-missing">` +
      `<div class="gd-missing">Screenshot &ldquo;${esc(id)}&rdquo; has not been captured yet</div>` +
      `${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`
    );
  }

  ctx.shots.push(id);
  const themes = meta.themes ?? ["light"];
  const src = (device, theme) => `/guide-shots/${id}--${device}--${theme}.webp`;

  const box = meta[primary];
  const pic = (theme) => {
    const t = themes.includes(theme) ? theme : themes[0];
    // A narrow <source> only when there is both a wide and a narrow capture.
    const narrow =
      primary === "desktop" && meta.phone
        ? `<source media="(max-width: 640px)" srcset="${src("phone", t)}" width="${meta.phone.w}" height="${meta.phone.h}">`
        : "";
    // The first figure on a page is eager: a lazy image already in the viewport
    // still decodes late, and the reader watches the gap fill in.
    const loading = ctx.shots.length === 1 && theme === themes[0] ? "eager" : "lazy";
    return (
      `<picture class="t-${theme}">${narrow}` +
      `<img src="${src(primary, t)}" alt="${esc(alt)}" ` +
      `width="${box.w}" height="${box.h}" loading="${loading}" decoding="async">` +
      `</picture>`
    );
  };

  return (
    `<figure class="gd-shot">${pic("light")}${pic("dark")}` +
    `${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}</figure>`
  );
}

function makeMarked(ctx) {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = uniqueId(ctx, slugify(strip(text)));
        if (depth === 2 || depth === 3) ctx.toc.push({ id, text: strip(text), depth });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      image({ href, title, text }) {
        if (href && href.startsWith("shot:")) return shot(ctx, href.slice(5), text, title);
        if (href && href.startsWith("video:")) return video(ctx, href.slice(6), text, title);
        return `<img src="${esc(href)}" alt="${esc(text)}" loading="lazy">`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        if (/^https?:/.test(href)) {
          return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"${
            title ? ` title="${esc(title)}"` : ""
          }>${text}</a>`;
        }
        ctx.links.push(href);
        // Guide-internal links are marked so the post-pass can check the target
        // exists. It cannot be checked here: the page being rendered may
        // legitimately link to one that has not been read yet.
        const guide = href.startsWith("/guide/") ? ` data-guide="${esc(href.split("#")[0])}"` : "";
        return `<a href="${esc(href)}"${guide}${title ? ` title="${esc(title)}"` : ""}>${text}</a>`;
      },
      table(token) {
        const cell = (c, tag) =>
          `<${tag}${c.align ? ` style="text-align:${c.align}"` : ""}>${this.parser.parseInline(
            c.tokens,
          )}</${tag}>`;
        const head = token.header.map((c) => cell(c, "th")).join("");
        const rows = token.rows.map((r) => `<tr>${r.map((c) => cell(c, "td")).join("")}</tr>`).join("");
        return `<div class="gd-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  return marked;
}

/**
 * Splits a body into top-level segments: plain Markdown, or one ::: container.
 * Fenced code is skipped, so a ::: inside a code block is just text.
 */
function containers(body, file) {
  const out = [];
  let buf = [];
  let fence = null;
  let box = null;
  const flush = () => {
    if (buf.join("").trim()) out.push({ kind: "md", text: buf.join("\n") });
    buf = [];
  };

  for (const line of body.split("\n")) {
    const f = line.match(/^\s*(```+|~~~+)/);
    if (f) {
      if (!fence) fence = f[1];
      else if (line.trim().startsWith(fence)) fence = null;
    }
    if (!fence && !f) {
      const open = line.match(/^:::(\w+)\s*(.*)$/);
      if (open && !box) {
        flush();
        box = { kind: open[1], arg: open[2].trim(), lines: [] };
        continue;
      }
      if (line.trim() === ":::" && box) {
        out.push({ kind: box.kind, arg: box.arg, text: box.lines.join("\n") });
        box = null;
        continue;
      }
    }
    (box ? box.lines : buf).push(line);
  }
  if (box) throw new Error(`${file}: unclosed :::${box.kind}`);
  flush();
  return out;
}

/** Splits text on "### Heading" lines into [{ title, text }]. */
function byHeading(text) {
  const items = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const h = line.match(/^###\s+(.*)$/);
    if (h) {
      cur = { title: h[1].trim(), lines: [] };
      items.push(cur);
    } else if (cur) cur.lines.push(line);
  }
  return items.map((i) => ({ title: i.title, text: i.lines.join("\n").trim() }));
}

const CALLOUTS = { note: "Note", tip: "Tip", warning: "Worth knowing", danger: "Careful" };
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const openapi = fs.existsSync(OPENAPI) ? JSON.parse(fs.readFileSync(OPENAPI, "utf8")) : null;

/**
 * Every operation carrying one OpenAPI tag, rendered from public/openapi.json.
 *
 * The reference pages are prose plus one of these, so the endpoint list cannot
 * disagree with the API: it is not written down twice. Until the document
 * exists the container renders a visible gap, the same way an uncaptured
 * screenshot does.
 */
function operations(ctx, tag) {
  if (!openapi) {
    ctx.missingOps.push(tag);
    return `<div class="gd-ops gd-ops-missing">Operations for &ldquo;${esc(
      tag,
    )}&rdquo; — public/openapi.json has not been generated yet</div>`;
  }
  const rows = [];
  for (const [p, item] of Object.entries(openapi.paths ?? {})) {
    for (const [method, op] of Object.entries(item)) {
      if (!METHODS.has(method.toUpperCase())) continue;
      if (!(op.tags ?? []).includes(tag)) continue;
      const scopes = op["x-builderhut-scopes"] ?? [];
      rows.push(
        `<li class="gd-op"><p class="gd-op-line">` +
          `<span class="gd-method gd-m-${method.toLowerCase()}">${esc(method.toUpperCase())}</span>` +
          `<code>${esc(p)}</code></p>` +
          `<p class="gd-op-summary">${esc(op.summary ?? "")}</p>` +
          (scopes.length ? `<p class="gd-op-scope">Requires <code>${esc(scopes.join(", "))}</code></p>` : "") +
          `</li>`,
      );
    }
  }
  if (!rows.length) throw new Error(`:::operations ${tag} — no operations carry that tag`);
  return `<ul class="gd-ops">${rows.join("")}</ul>\n`;
}

/*
 * A screenshot on a line of its own is an image, and Markdown wraps a
 * standalone image in a paragraph — but we render it as a <figure>, and a
 * <figure> inside a <p> is invalid. The browser closes the paragraph early and
 * leaves a stray empty one behind it, which shows up as a gap above every
 * picture that no amount of CSS explains.
 */
const unwrapFigures = (html) => html.replace(/<p>(<figure[\s\S]*?<\/figure>)<\/p>/g, "$1");

function render(ctx, body, file) {
  const marked = makeMarked(ctx);
  const md = (t) => unwrapFigures(marked.parse(t));
  const inline = (t) => marked.parseInline(t);
  let html = "";

  for (const seg of containers(body, file)) {
    switch (seg.kind) {
      case "md":
        html += md(seg.text);
        break;

      case "note":
      case "tip":
      case "warning":
      case "danger":
        html += `<aside class="gd-callout gd-${seg.kind}"><p class="gd-callout-title">${
          seg.arg ? inline(seg.arg) : CALLOUTS[seg.kind]
        }</p>${md(seg.text)}</aside>\n`;
        break;

      case "steps": {
        const steps = byHeading(seg.text);
        if (!steps.length) throw new Error(`${file}: :::steps with no ### step headings`);
        html += `<ol class="gd-steps">${steps
          .map((s) => `<li><p class="gd-step-title">${inline(s.title)}</p>${md(s.text)}</li>`)
          .join("")}</ol>\n`;
        break;
      }

      case "faq": {
        const qs = byHeading(seg.text);
        if (!qs.length) throw new Error(`${file}: :::faq with no ### questions`);
        html += `<div class="gd-faq">${qs
          .map((q) => `<details><summary>${inline(q.title)}</summary><div>${md(q.text)}</div></details>`)
          .join("")}</div>\n`;
        break;
      }

      case "endpoint": {
        // :::endpoint GET /products
        const [verb, ...rest] = seg.arg.split(/\s+/);
        if (!METHODS.has(verb?.toUpperCase())) {
          throw new Error(`${file}: :::endpoint needs a method and a path, got "${seg.arg}"`);
        }
        html +=
          `<div class="gd-endpoint"><p class="gd-op-line">` +
          `<span class="gd-method gd-m-${verb.toLowerCase()}">${esc(verb.toUpperCase())}</span>` +
          `<code>${esc(rest.join(" "))}</code></p>${md(seg.text)}</div>\n`;
        break;
      }

      case "operations":
        if (!seg.arg) throw new Error(`${file}: :::operations needs a tag`);
        html += operations(ctx, seg.arg);
        break;

      default:
        throw new Error(`${file}: unknown container :::${seg.kind}`);
    }
  }
  return html;
}

/* --------------------------------------------------------------------- build */

const pages = [];
const allMissing = [];
const allMissingOps = [];

/*
 * Authoring mistakes are reported as one line, not as a stack trace.
 *
 * This gate runs before typecheck precisely so that a forgotten ::: reads as
 * "docs/guide/start/010-welcome.md: unclosed :::note" rather than as forty
 * lines of Node internals ending in a file the author did not write. A stack
 * trace here would teach people the guide build is a programmer's problem.
 */
function build() {
for (const group of GROUPS) {
  const dir = path.join(SRC, group.id);
  if (!fs.existsSync(dir)) continue;

  const seenOrder = new Map();

  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith(".md")) continue;

    const full = path.join(dir, file);
    const rel = path.relative(ROOT, full);
    const { meta, body } = frontMatter(fs.readFileSync(full, "utf8"), rel);

    const m = file.match(/^(\d+)-(.+)\.md$/);
    if (!m) throw new Error(`${rel}: expected <NNN>-<slug>.md`);
    const [, order, slug] = m;

    // Two pages with the same number sort by filename instead, which is a
    // reading order nobody chose and nobody notices is wrong.
    if (seenOrder.has(order)) {
      throw new Error(`${rel}: order ${order} is already used by ${seenOrder.get(order)}`);
    }
    seenOrder.set(order, file);

    for (const key of ["title", "summary", "who"]) {
      if (!meta[key]) throw new Error(`${rel}: front matter is missing "${key}"`);
    }

    const ctx = {
      ids: new Set(),
      toc: [],
      links: [],
      shots: [],
      videos: [],
      missingShots: [],
      missingVideos: [],
      missingOps: [],
    };
    const html = render(ctx, body, rel);
    allMissing.push(...ctx.missingShots.map((id) => `${id}  (${rel})`));
    // A recording is held to the same standard as a screenshot: GUIDE_STRICT_SHOTS
    // fails the build rather than shipping a page with a hole where it should be.
    allMissing.push(...ctx.missingVideos.map((id) => `${id}  (${rel}, video)`));
    allMissingOps.push(...ctx.missingOps.map((t) => `${t}  (${rel})`));

    pages.push({
      slug,
      group: group.id,
      audience: group.audience,
      order: Number(order),
      title: meta.title,
      summary: meta.summary,
      who: meta.who,
      icon: meta.icon ?? "book",
      noindex: meta.noindex === "true" || AUDIENCES.find((a) => a.id === group.audience).noindex,
      related: list(meta.related),
      html,
      toc: ctx.toc,
      text: strip(html),
      links: ctx.links,
      anchors: [...ctx.ids],
      file: rel,
    });
  }
}
}

try {
  build();
} catch (error) {
  console.error(`guide:build FAILED — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

/* ------------------------------------------------------------- link checking */

const byPath = new Map(pages.map((p) => [`/guide/${p.group}/${p.slug}`, p]));
const APP_ROUTES =
  /^\/(|templates|guide|login|signup|verify|invite|onboarding|app|admin|s|dev|api|media|openapi\.json)(\/|$|\?|#)/;
const broken = [];
const pending = new Set();

/**
 * A link to a page of this guide that has not been written yet becomes plain
 * text rather than a dead link.
 *
 * The guide is written group by group, and a page in an early group routinely
 * wants to point at one in a later group. Failing the build would mean writing
 * the prose twice — once without the link and once with it — and shipping a
 * 404 would be worse. The sentence reads correctly either way, and the link
 * appears by itself the moment its target exists. GUIDE_STRICT_LINKS=1 makes
 * an unwritten target fatal, which is what CI runs.
 */
for (const page of pages) {
  const from = `/guide/${page.group}/${page.slug}`;

  page.html = page.html.replace(
    /<a href="[^"]*" data-guide="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g,
    (match, target, text) => {
      if (byPath.has(target)) return match.replace(/ data-guide="[^"]+"/, "");
      pending.add(`${from} → ${target}`);
      return `<span class="gd-pending">${text}</span>`;
    },
  );

  for (const href of page.links) {
    const [target, fragment] = href.split("#");

    /*
     * Fragments, which the reference implementation skips.
     *
     * A duplicate heading is renamed to "overview-2" by uniqueId(), so a
     * hand-written link to #overview that meant the second one silently
     * scrolls to the first. Nothing 404s and nobody notices, which is why it
     * has to be caught here rather than in review.
     */
    if (fragment) {
      const targetPage = target ? byPath.get(target) : page;
      if (targetPage && !targetPage.anchors.includes(fragment)) {
        broken.push(`${from} → ${href}  (no heading "#${fragment}" on that page)`);
      }
    }

    if (!target || target.startsWith("/guide/")) continue; // handled above, or a bare #anchor
    if (APP_ROUTES.test(target)) continue;
    broken.push(`${from} → ${href}`);
  }

  for (const r of page.related.filter((r) => !pages.some((p) => p.slug === r))) {
    pending.add(`${from} → related: ${r}`);
  }
  page.related = page.related.filter((r) => pages.some((p) => p.slug === r));
}

if (broken.length) {
  console.error("guide:build FAILED — links that go nowhere:\n");
  for (const b of broken) console.error(`  ${b}`);
  process.exit(1);
}

const strictLinks = process.env.GUIDE_STRICT_LINKS === "1";
if (pending.size) {
  const say = strictLinks ? console.error : console.warn;
  say(`\n${pending.size} link${pending.size === 1 ? "" : "s"} to pages not written yet:`);
  for (const p of [...pending].sort()) say(`  ${p}`);
  if (strictLinks) {
    console.error("\nGUIDE_STRICT_LINKS=1 requires every page referenced to exist.");
    process.exit(1);
  }
  console.warn("  (rendered as plain text until the page exists)\n");
}

/* ------------------------------------------------------------------- missing */

const strictShots = process.env.GUIDE_STRICT_SHOTS === "1";
for (const [what, items, fix] of [
  ["screenshot", allMissing, "Run `pnpm guide:shots`."],
  ["operation list", allMissingOps, "Run `pnpm openapi:generate`."],
]) {
  if (!items.length) continue;
  const say = strictShots ? console.error : console.warn;
  say(`\n${items.length} ${what}${items.length === 1 ? "" : "s"} not generated yet:`);
  for (const m of items) say(`  ${m}`);
  if (strictShots) {
    console.error(`\n${fix} A partial capture must not read as a complete one.`);
    process.exit(1);
  }
  console.warn("  (rendered as a visible gap; GUIDE_STRICT_SHOTS=1 makes this fatal)\n");
}

/* ---------------------------------------------------------------------- emit */

pages.sort((a, b) => a.order - b.order);

const groupsOut = GROUPS.map((g) => ({
  id: g.id,
  audience: g.audience,
  title: g.title,
  blurb: g.blurb,
}));

const json = (v) => JSON.stringify(v, null, 2);
const union = (values) => values.map((v) => `"${v}"`).join(" | ");

const HEADER = `// GENERATED by scripts/build-guide.mjs — do not edit.
// Source: docs/guide/**/*.md. Run \`pnpm guide:build\` after changing a page.
`;

const outFull = `${HEADER}
/*
 * The full guide, HTML included.
 *
 * server-only, deliberately: a client component that imported this would pull
 * every page's rendered HTML into a client chunk. Import nav.generated.ts
 * instead — it carries everything a sidebar or a search box needs.
 */
import "server-only";

import type { GuideHeading } from "./types";
import type { GuideAudienceId, GuideGroupId } from "./nav.generated";

export type GuidePage = {
  slug: string;
  group: GuideGroupId;
  audience: GuideAudienceId;
  order: number;
  title: string;
  summary: string;
  /** Who the page is for, shown as a pill under the title. */
  who: string;
  icon: string;
  /** Out of the sitemap, and noindex at runtime. */
  noindex: boolean;
  /** Slugs of pages shown as cards at the foot. */
  related: string[];
  /** Rendered at build time from a file in this repo. Never user input. */
  html: string;
  toc: GuideHeading[];
};

export type GuideGroup = {
  id: GuideGroupId;
  audience: GuideAudienceId;
  title: string;
  blurb: string;
};

export const GUIDE_GROUPS: GuideGroup[] = ${json(groupsOut)};

export const GUIDE_PAGES: GuidePage[] = ${json(
  // Explicit, not a rest spread: links, anchors, text and file are build-time
  // bookkeeping and have no business in the shipped module.
  pages.map((p) => ({
    slug: p.slug,
    group: p.group,
    audience: p.audience,
    order: p.order,
    title: p.title,
    summary: p.summary,
    who: p.who,
    icon: p.icon,
    noindex: p.noindex,
    related: p.related,
    html: p.html,
    toc: p.toc,
  })),
)};
`;

const outNav = `${HEADER}
/*
 * Titles, summaries and heading text — no HTML.
 *
 * Safe to import from a client component, which is the point: the sidebar and
 * its search filter this in memory, so there is no index to fetch and no
 * search dependency, and the guide's whole client footprint stays small enough
 * that check:budget never notices it.
 */

/*
 * The ids, as unions.
 *
 * They live here rather than in the hand-written types file because they are
 * derived from the group table in scripts/build-guide.mjs — a hand-written
 * copy is a copy that disagrees the first time a group is added.
 */
export type GuideAudienceId = ${union(AUDIENCES.map((a) => a.id))};
export type GuideGroupId = ${union(GROUPS.map((g) => g.id))};

export type GuideAudience = {
  id: GuideAudienceId;
  label: string;
  blurb: string;
  noindex: boolean;
};

export type GuideNavGroup = {
  id: GuideGroupId;
  audience: GuideAudienceId;
  title: string;
  blurb: string;
};

export type GuideNavPage = {
  slug: string;
  group: GuideGroupId;
  audience: GuideAudienceId;
  order: number;
  title: string;
  summary: string;
  /** Heading text, so search finds a page by something inside it. */
  headings: string[];
};

export const GUIDE_AUDIENCES: GuideAudience[] = ${json(AUDIENCES)};

export const GUIDE_NAV_GROUPS: GuideNavGroup[] = ${json(groupsOut)};

export const GUIDE_NAV: GuideNavPage[] = ${json(
  pages.map((p) => ({
    slug: p.slug,
    group: p.group,
    audience: p.audience,
    order: p.order,
    title: p.title,
    summary: p.summary,
    headings: p.toc.map((t) => t.text),
  })),
)};
`;

const targets = [
  [OUT_FULL, outFull],
  [OUT_NAV, outNav],
];

/*
 * --check regenerates and compares instead of writing.
 *
 * Both files are committed so the app never parses Markdown at runtime, and a
 * committed generated file drifts the moment somebody edits a page and forgets
 * to rebuild. A stale one is still valid TypeScript, so typecheck, lint, test
 * and build all pass happily — there is no later gate that catches this.
 */
if (process.argv.includes("--check")) {
  for (const [file, want] of targets) {
    const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (have !== want) {
      console.error(
        `check:guide FAILED — ${path.relative(ROOT, file)} is stale.\n\n` +
          "  Run `pnpm guide:build` and commit the result.",
      );
      process.exit(1);
    }
  }
  console.log(`check:guide ok — ${pages.length} pages, generated output matches source`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT_FULL), { recursive: true });
for (const [file, contents] of targets) fs.writeFileSync(file, contents);

console.log(
  `guide:build ok — ${pages.length} pages across ${new Set(pages.map((p) => p.group)).size} groups, ` +
    `${allMissing.length} shot${allMissing.length === 1 ? "" : "s"} missing`,
);
