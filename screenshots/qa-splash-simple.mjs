import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

function isNavy(rgb) {
  const n = (rgb.match(/\d+/g) || []).slice(0, 3).map(Number);
  if (n.length < 3) return false;
  const [r, g, b] = n;
  return r < 30 && g < 40 && b < 55 && b >= r && b >= g;
}

async function sample(page) {
  return page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const logo = document.querySelector(".splash-logo");
    const veil = document.querySelector(".splash-veil");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      hasSplash: !!splash,
      hasSkip: !!document.querySelector(".splash-skip"),
      hasTrace: !!document.querySelector(".splash-trace, .splash-draw, .splash-wave, .splash-pane"),
      htmlBg: cs(document.documentElement)?.backgroundColor,
      bodyBg: cs(document.body)?.backgroundColor,
      veilOp: veil ? Number(cs(veil)?.opacity || 0).toFixed(2) : "",
      logoOp: logo ? Number(cs(logo)?.opacity || 0).toFixed(2) : "0",
      blur: splash ? cs(splash)?.backdropFilter || cs(splash)?.webkitBackdropFilter : "",
      htmlClass: document.documentElement.className,
    };
  });
}

async function open(viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 800 ? 2 : 1,
    hasTouch: viewport.width < 800,
    isMobile: viewport.width < 800,
    colorScheme: "light",
  });
  await context.addInitScript(() => {
    for (const k of ["v16", "v17", "v18"]) {
      try {
        sessionStorage.removeItem(`rabotaem-splash-${k}`);
      } catch {
        /* ignore */
      }
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(base + "/", { waitUntil: "load", timeout: 30000 });
  await page.waitForSelector(".splash", { timeout: 8000 });
  await page.waitForTimeout(40);
  return { context, page, errors };
}

const report = {};
const desk = await open({ width: 1440, height: 900 });
report.errors = [...desk.errors];

await desk.page.waitForTimeout(60);
report.start = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-00-navy.jpg", type: "jpeg", quality: 72, timeout: 8000 });

await desk.page.waitForTimeout(640);
report.logo = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-01-logo.jpg", type: "jpeg", quality: 72, timeout: 8000 });

await desk.page.waitForTimeout(700);
report.blur = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-02-blur.jpg", type: "jpeg", quality: 72, timeout: 8000 });

await desk.page.waitForTimeout(900);
report.out = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-03-out.jpg", type: "jpeg", quality: 72, timeout: 8000 });
await desk.context.close();

const after = await open({ width: 1440, height: 900 });
await after.page.waitForFunction(() => !document.querySelector(".splash"), { timeout: 6000 }).catch(() => {});
report.after = await sample(after.page);
await after.page.screenshot({ path: "/workspace/screenshots/lg-04-home.jpg", type: "jpeg", quality: 72, timeout: 8000 });
await after.context.close();

const mob = await open({ width: 390, height: 844 });
await mob.page.waitForTimeout(80);
report.mobileStart = await sample(mob.page);
await mob.page.screenshot({ path: "/workspace/screenshots/lg-m-00.jpg", type: "jpeg", quality: 72, timeout: 8000 });
await mob.page.waitForTimeout(700);
report.mobileLogo = await sample(mob.page);
await mob.page.screenshot({ path: "/workspace/screenshots/lg-m-01.jpg", type: "jpeg", quality: 72, timeout: 8000 });
await mob.context.close();

await writeFile("/workspace/screenshots/lg-simple.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const fail = [];
if (!isNavy(report.start?.htmlBg) || !isNavy(report.start?.bodyBg)) fail.push("white first frame");
if (report.start?.hasSkip || report.start?.hasTrace) fail.push("old splash leftovers");
if (Number(report.logo?.logoOp) < 0.4) fail.push("logo did not fade in");
if (report.after?.hasSplash) fail.push("splash stuck");
if (fail.length) {
  console.error("FAIL", fail);
  process.exitCode = 1;
}
await browser.close();
