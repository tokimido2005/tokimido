import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function shot(name, viewport, waitMs) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    hasTouch: viewport.width < 800,
    isMobile: viewport.width < 800,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(waitMs);
  const splash = await page.locator(".splash").count();
  const logoSrc = await page.locator(".splash-logo").getAttribute("src").catch(() => null);
  const box = await page.locator(".splash-logo").boundingBox().catch(() => null);
  const tag = await page.locator(".splash-tagline").textContent().catch(() => null);
  await page.screenshot({ path: `/workspace/screenshots/${name}`, fullPage: false });
  await context.close();
  return { name, splash, logoSrc, box, tag, errors };
}

const mobileMid = await shot("splash-mobile.png", { width: 390, height: 844 }, 700);
const mobileLate = await shot("splash-mobile-hold.png", { width: 390, height: 844 }, 1400);
const desktop = await shot("splash-desktop.png", { width: 1280, height: 800 }, 700);
const after = await shot("splash-after.png", { width: 390, height: 844 }, 2600);

const logoOk = await fetch(base + "/logo-splash.png").then((r) => r.status);

const report = { logoOk, mobileMid, mobileLate, desktop, after };
console.log(JSON.stringify(report, null, 2));

const fatal = [];
if (logoOk !== 200) fatal.push("logo-splash 404");
if (mobileMid.splash < 1) fatal.push("mobile splash missing");
if (mobileMid.logoSrc !== "/logo-splash.png") fatal.push("wrong logo src " + mobileMid.logoSrc);
if (mobileMid.errors.length) fatal.push("errors " + mobileMid.errors.join("|"));
if (after.splash !== 0) fatal.push("splash did not dismiss");
if (fatal.length) {
  console.error("FAIL", fatal);
  process.exit(1);
}
await browser.close();
console.log("OK");
