import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".splash", { timeout: 8000 });

const times = [0, 80, 180, 320, 500, 800, 1200];
const frames = [];
let last = 0;
for (const t of times) {
  if (t > last) await page.waitForTimeout(t - last);
  last = t;
  const file = `/workspace/screenshots/splash-frame-${String(t).padStart(4, "0")}.png`;
  await page.screenshot({ path: file, fullPage: false });
  const info = await page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const img = document.querySelector(".splash-logo");
    const glass = document.querySelector(".splash-glass");
    const tag = document.querySelector(".splash-tagline");
    if (!img) return { hasSplash: !!splash, hasImg: false };
    const cs = getComputedStyle(img);
    const box = img.getBoundingClientRect();
    return {
      hasSplash: !!splash,
      hasImg: true,
      hasGlass: !!glass,
      src: img.getAttribute("src"),
      tag: tag?.textContent ?? "",
      bg: cs.backgroundColor,
      filter: cs.filter,
      webkitFilter: cs.webkitFilter,
      transform: cs.transform,
      animation: cs.animationName,
      box: { x: box.x, y: box.y, w: box.width, h: box.height },
    };
  });
  frames.push({ t, file, info });
}

await page.waitForTimeout(1600);
const afterSplash = await page.evaluate(() => !!document.querySelector(".splash"));
await page.screenshot({ path: "/workspace/screenshots/splash-home-after.png", fullPage: false });
await browser.close();

const report = { errors, afterSplash, frames };
console.log(JSON.stringify(report, null, 2));
await writeFile("/workspace/screenshots/splash-frames.json", JSON.stringify(report, null, 2));
if (errors.length) process.exit(1);
if (frames.some((f) => f.info.hasGlass)) {
  console.error("FAIL glass still in DOM");
  process.exit(1);
}
if (frames.some((f) => f.info.filter && f.info.filter !== "none")) {
  console.error("FAIL img still has filter");
  process.exit(1);
}
console.log("OK");
