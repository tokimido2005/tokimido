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
    try {
      sessionStorage.removeItem("rabotaem-splash-v6");
      sessionStorage.removeItem("rabotaem-splash-v5");
      sessionStorage.removeItem("rabotaem-splash-v4");
    } catch {
      /* ignore */
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
  await page.waitForTimeout(40);
}

async function sample(page) {
  return page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const logos = [...document.querySelectorAll(".splash-logo")];
    const bolt = document.querySelector(".splash-bolt");
    const left = document.querySelector(".splash-half-left");
    const right = document.querySelector(".splash-half-right");
    const tag = document.querySelector(".splash-tagline");
    const flash = document.querySelector(".splash-flash");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const box = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
    return {
      hasSplash: !!splash,
      hasTag: !!tag,
      logoCount: logos.length,
      logoSrc: logos[0]?.getAttribute("src") ?? "",
      logoOp: logos.map((l) => cs(l)?.opacity).join(","),
      logoBoxes: logos.map((l) => box(l)),
      boltOp: cs(bolt)?.opacity ?? "",
      boltClip: cs(bolt)?.clipPath ?? "",
      flashOp: cs(flash)?.opacity ?? "",
      halfTx: cs(left)?.transform ?? "",
      rightTx: cs(right)?.transform ?? "",
      splashBg: cs(splash)?.backgroundColor ?? "",
      htmlClass: document.documentElement.className,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
}

const desk = await open({ width: 1440, height: 900 });
const frames = [
  ["cut-00-navy", 80],
  ["cut-01-logo", 280],
  ["cut-02-heat", 600],
  ["cut-03-charge", 760],
  ["cut-04-strike", 920],
  ["cut-05-flash", 860],
  ["cut-06-split", 1300],
  ["cut-07-reveal", 1800],
];
const desktop = {};
for (const [name, ms] of frames) {
  await seek(desk.page, ms);
  desktop[name] = { ms, ...(await sample(desk.page)) };
  await desk.page.screenshot({ path: `/workspace/screenshots/${name}.jpg`, type: "jpeg", quality: 72, timeout: 10000 });
}
await desk.context.close();

const mob = await open({ width: 390, height: 844 });
const mobile = {};
for (const [name, ms] of [
  ["cut-m-logo", 280],
  ["cut-m-strike", 920],
  ["cut-m-split", 1300],
  ["cut-m-home", 1900],
]) {
  await seek(mob.page, ms);
  mobile[name] = { ms, ...(await sample(mob.page)) };
  await mob.page.screenshot({ path: `/workspace/screenshots/${name}.jpg`, type: "jpeg", quality: 72 });
}
await mob.context.close();

const after = await open({ width: 1280, height: 800 }, { keepSplash: false });
await after.page.waitForTimeout(2200);
const afterInfo = await sample(after.page);
await after.page.screenshot({ path: "/workspace/screenshots/cut-after-home.png", fullPage: false });
await after.context.close();

const report = { desktop, mobile, after: afterInfo, errors: [...desk.errors, ...mob.errors], afterErrors: after.errors };
await writeFile("/workspace/screenshots/cut-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
