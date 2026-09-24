import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto("http://localhost:3000/dev/builder-repro", { waitUntil: "networkidle" });

// Click "Product grid" in the Add panel, exactly as the screenshot shows.
await page.locator('button:has-text("Product grid")').first().click();
await page.waitForTimeout(600);

console.log("inspector heading:", await page.locator("#ctrl-heading").inputValue());
console.log("inspector columns:", await page.locator("#ctrl-columns").inputValue());
console.log("inspector ratio  :", await page.locator("#ctrl-imageRatio").inputValue());

// Is the newly selected section visible in the canvas viewport?
const info = await page.evaluate(() => {
  const scroller = document.querySelector("[data-storefront]").closest(".overflow-y-auto");
  return { scrollTop: scroller.scrollTop, clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight };
});
console.log("canvas scroller:", info);

// Where does the new section sit?
const pos = await page.evaluate(() => {
  const rings = [...document.querySelectorAll("[data-storefront] .group")];
  const last = rings[rings.length - 2]; // above footer
  const r = last.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewportH: window.innerHeight };
});
console.log("new section box:", pos);

await page.locator("#ctrl-heading").fill("Shop");
await page.waitForTimeout(400);
console.log("canvas headings:", await page.locator("[data-storefront] h2").allTextContents());
await page.screenshot({ path: "/private/tmp/claude-501/-Users-akash-Documents-BuilderHut/9664961b-211f-43ae-bd74-e27580143cca/scratchpad/add.png" });
await browser.close();
