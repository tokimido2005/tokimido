import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

function isLight(rgb) {
  const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return false;
  return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 > 90;
}

async function snap(page, path) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
  await writeFile(path, Buffer.from(data, "base64"));
}

async function open(viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: viewport.width < 800,
    isMobile: viewport.width < 800,
    colorScheme: "light",
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("rabotaem-theme", "light");
      for (const k of ["v13", "v14", "v15", "v16"]) {
        sessionStorage.removeItem(`rabotaem-splash-${k}`);
      }
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".splash", { timeout: 8000 });
  return { context, page, errors };
}

async function sample(page) {
  return page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const logo = document.querySelector(".splash-logo");
    const draw = document.querySelector(".splash-draw");
    const left = document.querySelector(".splash-pane-left");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      hasSplash: !!splash,
      hasSkip: !!document.querySelector(".splash-skip"),
      htmlBg: cs(document.documentElement)?.backgroundColor,
      bodyBg: cs(document.body)?.backgroundColor,
      splashBg: splash ? cs(splash)?.backgroundColor : "",
      logoOp: Number(cs(logo)?.opacity || 0).toFixed(2),
      dash: draw ? parseFloat(cs(draw)?.strokeDashoffset || "0") : -1,
      waves: document.querySelectorAll(".splash-wave").length,
      leftTx: left ? cs(left)?.transform : "",
      htmlClass: document.documentElement.className,
    };
  });
}

const desk = await open({ width: 1440, height: 900 });
const report = { desktop: {}, mobile: {}, errors: [...desk.errors] };
const t0 = Date.now();
const waitTo = async (ms) => {
  const d = ms - (Date.now() - t0);
  if (d > 0) await desk.page.waitForTimeout(d);
};

await waitTo(60);
report.desktop.start = await sample(desk.page);
await snap(desk.page, "/workspace/screenshots/lg-00-start.jpg");

await waitTo(520);
report.desktop.r = await sample(desk.page);
await snap(desk.page, "/workspace/screenshots/lg-01-r.jpg");

await waitTo(1400);
report.desktop.word = await sample(desk.page);
await snap(desk.page, "/workspace/screenshots/lg-02-word.jpg");

await waitTo(2300);
report.desktop.fill = await sample(desk.page);
await snap(desk.page, "/workspace/screenshots/lg-03-flash.jpg");

await waitTo(2750);
report.desktop.waves = await sample(desk.page);
await snap(desk.page, "/workspace/screenshots/lg-04-fill.jpg");

await waitTo(3550);
report.desktop.split = await sample(desk.page);
await snap(desk.page, "/workspace/screenshots/lg-05-split.jpg");
await desk.context.close();

const afterC = await open({ width: 1440, height: 900 });
await afterC.page.waitForFunction(() => !document.querySelector(".splash"), { timeout: 9000 }).catch(() => {});
report.after = await sample(afterC.page);
await snap(afterC.page, "/workspace/screenshots/lg-06-home.jpg");
await afterC.context.close();

const mob = await open({ width: 390, height: 844 });
await mob.page.waitForTimeout(80);
report.mobile.start = await sample(mob.page);
await snap(mob.page, "/workspace/screenshots/lg-m-start.jpg");
await mob.page.waitForTimeout(800);
report.mobile.trace = await sample(mob.page);
await snap(mob.page, "/workspace/screenshots/lg-m-trace.jpg");
await mob.page.waitForTimeout(2700);
report.mobile.split = await sample(mob.page);
await snap(mob.page, "/workspace/screenshots/lg-m-split.jpg");
await mob.context.close();

const white = {
  start: isLight(report.desktop.start?.htmlBg) || isLight(report.desktop.start?.bodyBg) || isLight(report.desktop.start?.splashBg),
  mobile: isLight(report.mobile.start?.htmlBg) || isLight(report.mobile.start?.bodyBg) || isLight(report.mobile.start?.splashBg),
};
report.whiteFlash = white;
report.ok = !white.start && !white.mobile && !report.desktop.start?.hasSkip;

await writeFile("/workspace/screenshots/lg-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!report.ok) process.exitCode = 1;
