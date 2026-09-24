/*
 * Photographs the guide's screenshots by driving the real application.
 *
 *   pnpm guide:shots              everything
 *   pnpm guide:shots --only dash  just the ids matching "dash"
 *   pnpm guide:shots --keep       reuse the merchant from the last run
 *
 * Not mock-ups and not a storyboard. This signs up, completes onboarding, adds
 * a catalogue, publishes, buys something, and photographs the result — so every
 * picture in the guide is the product doing the thing the page claims it does.
 *
 * WebP is encoded inside the browser that is already open, via an
 * OffscreenCanvas. That is the whole reason the format is WebP and not AVIF:
 * canvas can encode png, jpeg and webp and NOT avif, so avif would mean adding
 * sharp — a native dependency this repo deliberately disables the build script
 * for in pnpm-workspace.yaml.
 *
 * Expects a server it starts itself, with SMTP blanked so the verification code
 * is printed to a log rather than posted to a address that does not exist.
 */
import { chromium, devices, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import { SHOTS } from "../e2e/guide-shots/index";
import type { Device, Journey, Theme } from "../e2e/guide-shots/types";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "guide-shots");
const STATE = path.join(ROOT, ".guide-shots");
const LOG = path.join(STATE, "server.log");

const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;
const KEEP = process.argv.includes("--keep");

/*
 * 1280, not 1440.
 *
 * A screenshot is downscaled into a reading column a little over 800px wide,
 * so every pixel of capture width above that is legibility thrown away. At
 * 1440 the builder's three columns render at 39% and the inspector labels are
 * unreadable; at 1280 the same picture is half as shrunk. Both the builder and
 * the dashboard are fully usable at this width, so nothing is misrepresented.
 */
const VIEWPORT: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1280, height: 860 },
  phone: { width: 390, height: 844 },
};

/** The picture's width in the guide. Captured at 2x and downsampled to this. */
const TARGET_WIDTH: Record<Device, number> = { desktop: 1280, phone: 780 };

const PASSWORD = "a-long-enough-password";

/*
 * Candidates, tried in order, rather than a name with a random suffix.
 *
 * Re-runs collide on the slug, and the fallback was reached often enough that
 * the guide ended up illustrated with a shop called "Kiln and Clay gcg2" — a
 * detail nobody reads past once they have noticed it. A list this long is
 * cheaper than that.
 */
const STORE_NAMES = [
  "Kiln and Clay Ceramics",
  "Kiln and Clay Pottery",
  "Kiln and Clay Studio",
  "Kiln and Clay Works",
  "Kiln and Clay Atelier",
  "Kiln and Clay Table",
  "Kiln and Clay House",
  "Wheel and Kiln Ceramics",
  "Wheel and Kiln Pottery",
  "Wheel and Kiln Studio",
  "Ash and Ember Ceramics",
  "Ash and Ember Pottery",
  "Slipware and Stone",
  "The Ridged Bowl",
  "Stoneware and Slip",
];

const PRODUCTS = [
  {
    name: "Ridged stoneware vase",
    description:
      "Thrown on the wheel, then ridged with a rib while the clay is still soft. Holds water; the glaze stops short of the foot so the body shows.",
    price: "2400",
    compareAt: "2900",
    art: "vase",
  },
  {
    name: "Ash-glazed serving bowl",
    description: "Wide enough for a whole meal. The glaze pools darker where it runs.",
    price: "1850",
    art: "bowl",
  },
  {
    name: "Beeswax pillar candle",
    description: "Poured in small batches. Burns about forty hours.",
    price: "650",
    art: "candle",
  },
];

/* ── plumbing ─────────────────────────────────────────────────────────── */

const say = (message: string) => console.log(`  ${message}`);

async function freePort(): Promise<number> {
  for (let port = 4390; port < 4420; port += 1) {
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  throw new Error("no free port between 4390 and 4420");
}

/*
 * Bound to a port this script proved was free, and it fails rather than taking
 * one. A screenshot script that kills whatever is listening is a screenshot
 * script that kills somebody's dev server.
 */
/**
 * A production build, because this photographs the shop as it actually ships.
 *
 * Built here rather than assumed: `next typegen` clears .next, so anything that
 * ran typecheck since the last build leaves this script starting a server with
 * nothing to serve — which surfaces sixty seconds later as "the server did not
 * come up" rather than as the one-line reason.
 */
async function ensureBuild(): Promise<void> {
  if (existsSync(path.join(ROOT, ".next", "BUILD_ID"))) return;
  say("no production build — building first");
  await new Promise<void>((resolve, reject) => {
    const build = spawn("pnpm", ["build"], { stdio: "inherit" });
    build.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("pnpm build failed"))));
  });
}

async function startServer(port: number): Promise<ChildProcess> {
  mkdirSync(STATE, { recursive: true });
  writeFileSync(LOG, "");

  /*
   * detached, so the whole process group can be signalled on the way out.
   *
   * pnpm spawns `next start` as a grandchild, and killing pnpm leaves that
   * grandchild holding the port — so the next run finds it occupied, picks a
   * different port, and the machine accumulates a dead server per capture.
   */
  const child = spawn("pnpm", ["start", "-p", String(port)], {
    detached: true,
    env: {
      ...process.env,
      APP_URL: `http://localhost:${port}`,
      // Blanked so the email provider prints the six-digit code instead of
      // sending it, which is how the code is read back below.
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let log = "";
  const collect = (chunk: Buffer) => {
    log += chunk.toString();
    writeFileSync(LOG, log);
  };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    if (/EADDRINUSE|Failed to start/i.test(log)) throw new Error(`server failed:\n${log}`);
    const ok = await fetch(`http://localhost:${port}/guide`)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return child;
  }
  throw new Error(`server did not come up:\n${log}`);
}

/**
 * The six-digit code, read back out of the server's own output.
 *
 * Self-contained rather than shared with e2e/support: that helper imports
 * Playwright's test runner, which does not exist outside a spec.
 */
async function verificationCode(email: string): Promise<string> {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`To:\\s+${escaped}[\\s\\S]{0,400}?verification code is (\\d{6})`, "g");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const match = [...readFileSync(LOG, "utf8").matchAll(pattern)].pop();
    if (match?.[1]) return match[1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no verification code was printed for ${email}`);
}

/* ── product photographs, drawn rather than shipped ───────────────────── */

/*
 * demo/assets/*.png exists but demo/ is gitignored in its entirety, so a
 * committed script cannot read it — it would work on one machine and nowhere
 * else. These are drawn in the browser instead, which also means the catalogue
 * looks the same on every run.
 */
async function makeArtwork(browser: Browser): Promise<Record<string, string>> {
  const page = await browser.newPage();
  const dir = path.join(STATE, "art");
  mkdirSync(dir, { recursive: true });

  const pieces: Record<string, string> = {
    vase: `<div style="width:132px;height:64px;border-radius:66px/24px;background:linear-gradient(100deg,#7d6950,#5b4a38);margin-bottom:-22px;position:relative;z-index:2"></div>
           <div style="width:132px;height:96px;background:linear-gradient(100deg,#6f5c46,#4e4032)"></div>
           <div style="width:340px;height:430px;border-radius:170px 170px 110px 110px/230px 230px 80px 80px;background:linear-gradient(100deg,#8b7458,#6a5945 42%,#463a2d);margin-top:-14px"></div>`,
    bowl: `<div style="width:560px;height:96px;border-radius:50%;background:linear-gradient(100deg,#b7a184,#8a7359);margin-bottom:-52px;position:relative;z-index:2"></div>
           <div style="width:560px;height:320px;border-radius:0 0 280px 280px/0 0 300px 300px;background:linear-gradient(175deg,#9c8567,#6d5c47 55%,#463a2e)"></div>`,
    candle: `<div style="width:10px;height:46px;border-radius:5px;background:#4a3d2a;margin-bottom:-4px"></div>
             <div style="width:230px;height:54px;border-radius:50%;background:linear-gradient(100deg,#f6e7bd,#dcc08a)"></div>
             <div style="width:230px;height:470px;border-radius:0 0 14px 14px;margin-top:-27px;background:linear-gradient(100deg,#f2dfaf,#d9bd84 55%,#b89a62)"></div>`,
  };

  const files: Record<string, string> = {};
  for (const [name, parts] of Object.entries(pieces)) {
    await page.setContent(`<!doctype html><body style="margin:0">
      <div style="width:900px;height:1100px;background:radial-gradient(120% 90% at 50% 12%,rgba(255,255,255,.85),rgba(0,0,0,0) 60%),linear-gradient(168deg,#f4ede1,#ddd2c0);
                  display:flex;align-items:flex-end;justify-content:center;padding-bottom:320px;box-sizing:border-box;position:relative">
        <div style="position:absolute;bottom:296px;width:58%;height:46px;border-radius:50%;background:rgba(58,44,30,.22);filter:blur(22px)"></div>
        <div style="display:flex;flex-direction:column;align-items:center;position:relative">${parts}</div>
      </div></body>`);
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file });
    files[name] = file;
  }
  await page.close();
  return files;
}

/* ── the journey ──────────────────────────────────────────────────────── */

async function drive(browser: Browser, base: string): Promise<Journey> {
  const context = await browser.newContext({ viewport: VIEWPORT.desktop, colorScheme: "light" });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("bh-theme", "light");
    } catch {}
  });
  const page = await context.newPage();
  const email = `guide-${Date.now().toString(36)}@builderhut.test`;

  say("signing up");
  await page.goto(`${base}/signup`);
  await page.fill("#name", "Anjali Rao");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/verify/, { timeout: 30_000 });

  const code = await verificationCode(email);
  for (const [i, digit] of [...code].entries()) {
    await page.locator('input[inputmode="numeric"]').nth(i).fill(digit).catch(() => {});
  }
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 }).catch(async () => {
    await page.click('button[type="submit"]').catch(() => {});
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  });

  say("onboarding");
  const step = async (label: string) => {
    await page.locator(`button:has-text("${label}")`).first().click();
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(300);
  };
  await step("Home Decor");

  let storeName = "";
  for (const candidate of STORE_NAMES) {
    await page.fill("#store-name", candidate);
    const free = await page
      .getByText("That one's free.")
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (free) {
      storeName = candidate;
      break;
    }
  }
  if (!storeName) {
    throw new Error(
      "every candidate shop name is taken. Add one to STORE_NAMES, or clear out " +
        "the shops left behind by previous capture runs.",
    );
  }
  await page.locator('button:has-text("Continue")').first().click();
  await step("Instagram");
  await step("A full online shop");
  await step("India");

  await page.locator('button:has-text("Hearth")').first().click().catch(() => {});
  await page.locator('button:has-text("Create my store")').first().click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 90_000 });

  const slug = storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  say(`store created: ${slug}`);

  say("adding the catalogue");
  const art = await makeArtwork(browser);
  for (const product of PRODUCTS) {
    await page.goto(`${base}/app/products/new`);
    await page.fill("#name", product.name);
    await page.fill("#description", product.description);
    await page.fill("#price", product.price);
    if (product.compareAt) await page.fill("#compareAt", product.compareAt);
    await page.locator('input[type="file"][multiple]').setInputFiles(art[product.art]!);
    await page.getByLabel("Move picture 1 earlier").waitFor({ timeout: 120_000 });
    await page.click('button[type="submit"]');
    await page.getByText("in your catalogue").waitFor({ timeout: 45_000 });
  }

  await page.goto(`${base}/app/products`);
  /*
   * Not simply the first product link: "New product" is one too, and its href
   * is /app/products/new. Taking it produced a picture of the empty create
   * form filed under "product-images" — a perfectly sharp screenshot of the
   * wrong screen, which is the one defect nobody catches by looking at the
   * list of files.
   */
  const hrefs = await page.locator('a[href^="/app/products/"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  );
  const productId =
    hrefs.map((href) => href.split("/").pop() ?? "").find((id) => id && id !== "new") ?? "";
  if (!productId) throw new Error("no product to photograph: the catalogue step did not take");

  say("publishing");
  await page.goto(`${base}/app/builder`);
  await page.locator('button:has-text("Publish")').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Publish")').last().click().catch(() => {});
  await page.waitForTimeout(4000);

  say("buying something");
  const shopper = await browser.newContext({ viewport: VIEWPORT.desktop });
  const shop = await shopper.newPage();
  await shop.goto(`${base}/s/${slug}`);
  const productLink = shop.locator(`a[href^="/s/${slug}/p/"]`).first();
  const productSlug =
    (await productLink.getAttribute("href").catch(() => null))?.split("/").pop() ?? "";
  const orderId = "";
  if (productSlug) {
    await shop.goto(`${base}/s/${slug}/p/${productSlug}`);
    await shop.locator('button:has-text("Add to basket")').first().click().catch(() => {});
    await shop.waitForTimeout(1500);
  }
  await shopper.close();

  const journey: Journey = { email, storeName, slug, productId, productSlug, orderId };
  writeFileSync(path.join(STATE, "journey.json"), JSON.stringify(journey, null, 2));
  await context.storageState({ path: path.join(STATE, "merchant.json") });
  await context.close();
  return journey;
}

/**
 * Refuse to photograph a page whose stylesheet did not arrive.
 *
 * This has happened: one run saved a perfectly valid WebP of the product form
 * as raw HTML — Times, blue links, the sidebar as a bullet list — and it sat in
 * the guide looking like a screenshot until somebody read it. A file that size
 * and shape passes every other check there is, so the only place to catch it is
 * before it is written.
 */
async function assertStyled(page: Page, id: string): Promise<void> {
  const state = await page.evaluate(() => {
    let rules = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        rules += sheet.cssRules.length;
      } catch {
        // A cross-origin sheet cannot be counted, but it did load.
        rules += 1;
      }
    }
    const body = getComputedStyle(document.body).backgroundColor;
    return { rules, body };
  });

  /*
   * Pure white is the tell. Every BuilderHut surface paints a token — bone in
   * light, warm near-black in dark — and none of them is #fff, so a white body
   * means the stylesheet never arrived. "Not transparent" was too weak a test:
   * the browser resolves an unstyled body to white, which passed.
   */
  const white = /^rgba?\(\s*255,\s*255,\s*255/.test(state.body);
  const bare = state.body === "" || state.body === "rgba(0, 0, 0, 0)" || state.body === "transparent";
  if (state.rules === 0 || white || bare) {
    throw new Error(
      `${id}: rendered without its stylesheet (${state.rules} rules, body ${state.body || "unset"})`,
    );
  }
}

/* ── screens you only see on the way in ───────────────────────────────── */

/*
 * The six-digit code screen, the first onboarding question and the template
 * picker cannot be reached by URL once a shop exists: /verify has nothing
 * pending and /onboarding redirects to the dashboard. So they get their own
 * throwaway account, driven as far as each screen and then abandoned — no shop
 * is ever created by this.
 *
 * Run once per theme, because there is no way back to a screen you have
 * already walked past.
 */
async function captureArrival(
  browser: Browser,
  base: string,
  manifest: Record<string, unknown>,
): Promise<void> {
  for (const theme of ["light", "dark"] as Theme[]) {
    const context = await browser.newContext({
      viewport: VIEWPORT.desktop,
      deviceScaleFactor: 2,
      colorScheme: theme,
    });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("bh-theme", t as string);
      } catch {}
    }, theme);
    const page = await context.newPage();
    const email = `arrival-${Date.now().toString(36)}@builderhut.test`;

    const keep = async (id: string) => {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      await assertStyled(page, id);
      const webp = await toWebp(page, await page.screenshot(), TARGET_WIDTH.desktop);
      writeFileSync(path.join(OUT, `${id}--desktop--${theme}.webp`), webp);
      const entry = (manifest[id] ??= {}) as Record<string, unknown>;
      entry.desktop = { w: VIEWPORT.desktop.width, h: VIEWPORT.desktop.height };
      entry.themes = [...new Set([...((entry.themes as Theme[]) ?? []), theme])];
      say(`  OK ${id}--desktop--${theme}  ${(webp.length / 1024).toFixed(0)} KB`);
    };

    try {
      await page.goto(`${base}/signup`);
      await page.fill("#name", "Anjali Rao");
      await page.fill("#email", email);
      await page.fill("#password", PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/verify/, { timeout: 30_000 });
      await keep("verify-code");

      const code = await verificationCode(email);
      for (const [index, digit] of [...code].entries()) {
        await page
          .locator('input[inputmode="numeric"]')
          .nth(index)
          .fill(digit)
          .catch(() => {});
      }
      await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
      await keep("onboarding-industry");

      const step = async (label: string) => {
        await page.locator(`button:has-text("${label}")`).first().click();
        await page.locator('button:has-text("Continue")').first().click();
        await page.waitForTimeout(400);
      };
      await step("Home Decor");
      await page.fill("#store-name", `Arrival ${Date.now().toString(36).slice(-5)}`);
      await page.getByText("free").first().waitFor({ timeout: 15_000 });
      await page.locator('button:has-text("Continue")').first().click();
      await step("Instagram");
      await step("A full online shop");
      await step("India");
      await page.waitForTimeout(1500);
      await keep("template-picker");
    } catch (error) {
      say(`  -- arrival (${theme}): ${(error as Error).message.split("\n")[0]}`);
    }
    await context.close();
  }
}

/* ── capture ──────────────────────────────────────────────────────────── */

/**
 * PNG in, WebP out, encoded by the browser already on screen.
 *
 * Downsampled from a 2x capture to the width the guide actually renders it at,
 * so the picture is a genuine 2x on a 720px prose column rather than a 1440px
 * image scaled down by the browser on every view.
 */
async function toWebp(page: Page, png: Buffer, width: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([data, target]) => {
      const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, (target as number) / bitmap.width);
      const canvas = new OffscreenCanvas(
        Math.round(bitmap.width * scale),
        Math.round(bitmap.height * scale),
      );
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const out = await canvas.convertToBlob({ type: "image/webp", quality: 0.82 });
      if (out.type !== "image/webp") throw new Error(`browser encoded ${out.type}, not webp`);
      const buffer = await out.arrayBuffer();
      let binary = "";
      for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    [png.toString("base64"), width] as const,
  );
  return Buffer.from(base64, "base64");
}

async function main() {
  await ensureBuild();
  const port = await freePort();
  say(`port ${port}`);
  let server = await startServer(port);
  const base = `http://localhost:${port}`;

  /*
   * The server has died mid-run more than once, and the failure is quiet in the
   * worst way: the pages already photographed are fine, and every one after it
   * is either a connection refused or — far worse — an HTML response whose
   * stylesheet 404s, which writes a perfectly valid picture of an unstyled
   * page. Rather than lose a five-minute run, bring it back and carry on.
   */
  const ensureAlive = async () => {
    const ok = await fetch(`${base}/guide`)
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) return;
    say("  the server went away — restarting it");
    try {
      if (server.pid) process.kill(-server.pid, "SIGKILL");
    } catch {}
    server = await startServer(port);
  };
  const browser = await chromium.launch();

  try {
    const journeyFile = path.join(STATE, "journey.json");
    const journey: Journey =
      KEEP && existsSync(journeyFile)
        ? JSON.parse(readFileSync(journeyFile, "utf8"))
        : await drive(browser, base);

    mkdirSync(OUT, { recursive: true });
    const manifest: Record<string, unknown> = existsSync(path.join(OUT, "manifest.json"))
      ? JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"))
      : {};

    const wanted = SHOTS.filter((s) => !ONLY || s.id.includes(ONLY));
    say(`capturing ${wanted.length} shots`);

    for (const device of ["desktop", "phone"] as Device[]) {
      for (const theme of ["light", "dark"] as Theme[]) {
        const shots = wanted.filter(
          (s) =>
            (s.devices ?? ["desktop"]).includes(device) &&
            (s.themes ?? ["light", "dark"]).includes(theme),
        );
        if (!shots.length) continue;

        const context = await browser.newContext({
          ...(device === "phone" ? devices["iPhone 15"] : { viewport: VIEWPORT.desktop }),
          deviceScaleFactor: 2,
          colorScheme: theme,
          storageState: existsSync(path.join(STATE, "merchant.json"))
            ? path.join(STATE, "merchant.json")
            : undefined,
        });
        /*
         * localStorage, not the attribute. lib/theme.tsx stamps data-theme from
         * the stored value before first paint, so setting the attribute after
         * load is undone by the next navigation — and you get a run where half
         * the pictures are the wrong theme and nothing errors.
         */
        await context.addInitScript((t) => {
          try {
            localStorage.setItem("bh-theme", t as string);
          } catch {}
        }, theme);

        const page = await context.newPage();

        for (const shot of shots) {
          const url = typeof shot.path === "function" ? shot.path(journey) : shot.path;
          await ensureAlive();
          try {
            await page.goto(base + url, { waitUntil: "networkidle", timeout: 45_000 });
            await page
              .waitForFunction(() => document.styleSheets.length > 0, null, { timeout: 15_000 })
              .catch(() => {});
            const actual = await page.evaluate(() => document.documentElement.dataset.theme);
            // Storefronts deliberately do not follow our theme; everything else must.
            if (!url.startsWith(`/s/`) && actual !== theme) {
              throw new Error(`theme is ${actual}, wanted ${theme}`);
            }
            if (shot.waitFor) {
              await page.getByText(shot.waitFor).first().waitFor({ timeout: 15_000 });
            }
            if (shot.prepare) await shot.prepare(page, device);
            await page.evaluate(() => document.fonts.ready);
            await assertStyled(page, shot.id);
            await page.waitForTimeout(600);
            if (shot.height && device === "desktop") {
              await page.setViewportSize({ width: VIEWPORT.desktop.width, height: shot.height });
              await page.waitForTimeout(300);
            }

            const target = shot.element ? shot.element(page) : page;
            const png = await target.screenshot({ mask: shot.mask?.(page) ?? [] });
            const webp = await toWebp(page, png, TARGET_WIDTH[device] * 1);
            const file = path.join(OUT, `${shot.id}--${device}--${theme}.webp`);
            writeFileSync(file, webp);

            const size = await page.evaluate(
              async ([data]) => {
                const bitmap = await createImageBitmap(
                  await (await fetch(`data:image/webp;base64,${data}`)).blob(),
                );
                return { w: bitmap.width, h: bitmap.height };
              },
              [webp.toString("base64")] as const,
            );

            const entry = (manifest[shot.id] ??= {}) as Record<string, unknown>;
            entry[device] = size;
            const themes = new Set([...((entry.themes as Theme[]) ?? []), theme]);
            entry.themes = [...themes];
            if (device === "phone") entry.phone = size;

            say(`  ✓ ${shot.id}--${device}--${theme}  ${(webp.length / 1024).toFixed(0)} KB`);
          } catch (error) {
            /*
             * One retry, after making sure the server is up. Most failures here
             * are the server having gone away, and a shot silently missing is
             * how a gap ends up in the guide.
             */
            try {
              await ensureAlive();
              await page.goto(base + url, { waitUntil: "networkidle", timeout: 45_000 });
              if (shot.prepare) await shot.prepare(page, device);
              await page.evaluate(() => document.fonts.ready);
              await page.waitForTimeout(700);
              await assertStyled(page, shot.id);
              const target = shot.element ? shot.element(page) : page;
              const webp = await toWebp(
                page,
                await target.screenshot({ mask: shot.mask?.(page) ?? [] }),
                TARGET_WIDTH[device],
              );
              writeFileSync(path.join(OUT, `${shot.id}--${device}--${theme}.webp`), webp);
              const entry = (manifest[shot.id] ??= {}) as Record<string, unknown>;
              entry[device] = { w: TARGET_WIDTH[device], h: shot.height ?? VIEWPORT[device].height };
              entry.themes = [...new Set([...((entry.themes as Theme[]) ?? []), theme])];
              if (device === "phone") entry.phone = entry[device];
              say(`  ✓ ${shot.id}--${device}--${theme}  (retry)  ${(webp.length / 1024).toFixed(0)} KB`);
            } catch (retryError) {
              say(
                `  ✗ ${shot.id}--${device}--${theme}  ${(retryError as Error).message.split("\n")[0]}`,
              );
            }
          }
        }
        await context.close();
      }
    }

    if (!ONLY) {
      say("capturing the screens you only see on the way in");
      await captureArrival(browser, base, manifest);
    }

    writeFileSync(path.join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    say(`manifest: ${Object.keys(manifest).length} shots`);
  } finally {
    await browser.close();
    // Negative pid: the group, not just pnpm. See the comment on spawn above.
    try {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill();
    }
  }
}

await main();
