import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

function isNavy(r, g, b) {
  return r < 30 && g < 40 && b < 55 && b >= r && b >= g;
}

async function corner(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return {
      htmlBg: html ? getComputedStyle(html).backgroundColor : "",
      bodyBg: body ? getComputedStyle(body).backgroundColor : "",
      scheme: html ? getComputedStyle(html).colorScheme : "",
      hasSplash: !!document.querySelector(".splash"),
      hasSkip: !!document.querySelector(".splash-skip"),
      htmlClass: html?.className ?? "",
      splashBg: document.querySelector(".splash")
        ? getComputedStyle(document.querySelector(".splash")).backgroundColor
        : "",
    };
  });
}

async function sample(page) {
  return page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const draw = document.querySelector(".splash-draw");
    const logo = document.querySelector(".splash-logo");
    const left = document.querySelector(".splash-pane-left");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const dash = draw ? parseFloat(cs(draw)?.strokeDashoffset || "0") : -1;
    const dashArr = draw ? parseFloat((cs(draw)?.strokeDasharray || "0").split(" ")[0]) : 0;
    return {
      hasSplash: !!splash,
      hasSkip: !!document.querySelector(".splash-skip"),
      waveCount: document.querySelectorAll(".splash-wave").length,
      trace: splash ? cs(splash)?.getPropertyValue("--trace").trim() : "",
      logoVar: splash ? cs(splash)?.getPropertyValue("--logo").trim() : "",
      split: splash ? cs(splash)?.getPropertyValue("--split").trim() : "",
      logoOp: Number(cs(logo)?.opacity || 0).toFixed(2),
      drawn: dashArr > 0 ? Number(1 - dash / dashArr).toFixed(3) : "0",
      htmlBg: cs(document.documentElement)?.backgroundColor,
      bodyBg: cs(document.body)?.backgroundColor,
      splashBg: splash ? cs(splash)?.backgroundColor : "",
      open: splash?.classList.contains("is-open") ?? false,
      waves: splash?.classList.contains("is-waves") ?? false,
      leftTx: left ? cs(left)?.transform : "",
      htmlClass: document.documentElement.className,
    };
  });
}

async function open(viewport, extra = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 800 ? 2 : 1,
    hasTouch: viewport.width < 800,
    isMobile: viewport.width < 800,
    colorScheme: "light",
    ...extra,
  });
  await context.addInitScript(() => {
    for (const k of ["v14", "v15", "v16", "v17"]) {
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
  return { context, page, errors };
}

const report = {};

const first = await open({ width: 1440, height: 900 });
await first.page.goto(base + "/", { waitUntil: "commit", timeout: 30000 });
await first.page.waitForFunction(() => !!document.documentElement, { timeout: 5000 });
await first.page.waitForTimeout(40);
report.commit = await corner(first.page);
await first.page.screenshot({ path: "/workspace/screenshots/lg-00-first.jpg", type: "jpeg", quality: 80, timeout: 10000 });
const buf = await first.page.screenshot({ type: "png" });
report.commit.pixel = [...buf.slice(0, 0)]; // placeholder
{
  const png = await first.page.screenshot({ type: "png" });
  // PNG header then IHDR; sample via page instead
  report.commit.samplePx = await first.page.evaluate(() => {
    const s = getComputedStyle(document.documentElement).backgroundColor;
    return s;
  });
}
await first.context.close();

const desk = await open({ width: 1440, height: 900 });
await desk.page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
await desk.page.waitForSelector(".splash", { timeout: 8000 });
report.errors = [...desk.errors];

await desk.page.waitForTimeout(80);
report.start = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-01-navy.jpg", type: "jpeg", quality: 72, timeout: 10000 });

await desk.page.waitForTimeout(700);
report.r = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-02-r.jpg", type: "jpeg", quality: 72, timeout: 10000 });

await desk.page.waitForTimeout(900);
report.word = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-03-word.jpg", type: "jpeg", quality: 72, timeout: 10000 });

await desk.page.waitForTimeout(700);
report.fill = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-04-fill.jpg", type: "jpeg", quality: 72, timeout: 10000 });

await desk.page.waitForTimeout(1100);
report.split = await sample(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/lg-05-split.jpg", type: "jpeg", quality: 72, timeout: 10000 });
await desk.context.close();

const after = await open({ width: 1440, height: 900 });
await after.page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
await after.page.waitForFunction(() => !document.querySelector(".splash"), { timeout: 9000 }).catch(() => {});
report.after = await sample(after.page);
await after.page.screenshot({ path: "/workspace/screenshots/lg-06-home.jpg", type: "jpeg", quality: 72, timeout: 10000 });
await after.context.close();

const mob = await open({ width: 390, height: 844 });
await mob.page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
await mob.page.waitForSelector(".splash", { timeout: 8000 });
await mob.page.waitForTimeout(120);
report.mobileStart = await sample(mob.page);
await mob.page.screenshot({ path: "/workspace/screenshots/lg-m-00.jpg", type: "jpeg", quality: 72, timeout: 10000 });
await mob.page.waitForTimeout(1000);
report.mobileMid = await sample(mob.page);
await mob.page.screenshot({ path: "/workspace/screenshots/lg-m-01.jpg", type: "jpeg", quality: 72, timeout: 10000 });
await mob.context.close();

report.navyOk = {
  commitHtml: isNavy(...(report.commit.htmlBg.match(/\d+/g) || []).slice(0, 3).map(Number)),
  startBody: isNavy(...(report.start.bodyBg.match(/\d+/g) || []).slice(0, 3).map(Number)),
  mobileBody: isNavy(...(report.mobileStart.bodyBg.match(/\d+/g) || []).slice(0, 3).map(Number)),
};

await writeFile("/workspace/screenshots/lg-navy.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

if (!report.navyOk.commitHtml || !report.navyOk.startBody) {
  console.error("FAIL white first frame");
  process.exitCode = 1;
}
if (report.start?.hasSkip || report.start?.waveCount !== 4) {
  console.error("FAIL skip or wave count", report.start?.waveCount);
  process.exitCode = 1;
}
await browser.close();
