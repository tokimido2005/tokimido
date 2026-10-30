import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function open(viewport, { keepSplash = true } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 800 ? 2 : 1,
    hasTouch: viewport.width < 800,
    isMobile: viewport.width < 800,
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() => {
    for (const k of ["v4", "v5", "v6", "v7", "v8"]) {
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
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".splash-play", { timeout: 8000 });
  if (keepSplash) {
    await page.addStyleTag({
      content: "html.rbt-splash-done .splash{display:block!important}",
    });
  }
  return { context, page, errors };
}

async function seek(page, ms) {
  await page.evaluate((t) => {
    document.documentElement.classList.add("rbt-splash");
    document.documentElement.classList.remove("rbt-splash-done");
    for (const a of document.getAnimations()) {
      const fx = a.effect;
      const el = fx && "target" in fx ? fx.target : null;
      if (el && (el.classList?.contains("splash") || el.closest?.(".splash"))) {
        a.currentTime = t;
        a.pause();
      }
    }
  }, ms);
  await page.waitForTimeout(50);
}

async function sample(page) {
  return page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const logo = document.querySelector(".splash-logo");
    const glow = document.querySelector(".splash-r-glow");
    const waves = [...document.querySelectorAll(".splash-wave")];
    const bolt = document.querySelector(".splash-bolt");
    const half = document.querySelector(".splash-half");
    const tag = document.querySelector(".splash-tagline");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      hasSplash: !!splash,
      hasBolt: !!bolt,
      hasHalf: !!half,
      hasTag: !!tag,
      logoSrc: logo?.getAttribute("src") ?? "",
      logoOp: cs(logo)?.opacity ?? "",
      splashOp: cs(splash)?.opacity ?? "",
      splashBlur: cs(splash)?.filter ?? "",
      rGlow: cs(glow)?.opacity ?? "",
      waves: waves.map((w) => ({
        op: cs(w)?.opacity,
        tf: cs(w)?.transform,
      })),
      htmlClass: document.documentElement.className,
    };
  });
}

const desk = await open({ width: 1440, height: 900 });
const desktop = {};
for (const [name, ms] of [
  ["wv-00-logo", 80],
  ["wv-01-glow", 360],
  ["wv-02-wave1", 520],
  ["wv-03-wave2", 740],
  ["wv-04-wave3", 920],
  ["wv-05-fade", 1450],
  ["wv-06-out", 1780],
]) {
  await seek(desk.page, ms);
  desktop[name] = { ms, ...(await sample(desk.page)) };
  await desk.page.screenshot({
    path: `/workspace/screenshots/${name}.jpg`,
    type: "jpeg",
    quality: 74,
    timeout: 10000,
  });
}
await desk.context.close();

const mob = await open({ width: 390, height: 844 });
await seek(mob.page, 740);
const mobile = await sample(mob.page);
await mob.page.screenshot({
  path: "/workspace/screenshots/wv-m-wave.jpg",
  type: "jpeg",
  quality: 74,
  timeout: 10000,
});
await mob.context.close();

const after = await open({ width: 1280, height: 800 }, { keepSplash: false });
await after.page.waitForTimeout(2100);
const afterInfo = await sample(after.page);
await after.page.screenshot({ path: "/workspace/screenshots/wv-after-home.png", fullPage: false });
await after.context.close();

const report = { desktop, mobile, after: afterInfo, errors: [...desk.errors, ...mob.errors] };
await writeFile("/workspace/screenshots/wv-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
