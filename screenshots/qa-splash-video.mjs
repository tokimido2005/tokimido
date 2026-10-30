import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});

async function open(viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 800 ? 2 : 1,
    hasTouch: viewport.width < 800,
    isMobile: viewport.width < 800,
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() => {
    for (const k of ["v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10"]) {
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
  await page.waitForSelector(".splash", { timeout: 8000 });
  return { context, page, errors };
}

async function sample(page) {
  return page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const video = document.querySelector(".splash-video");
    const skip = document.querySelector(".splash-skip");
    const open = splash?.classList.contains("is-open") ?? false;
    const split = splash ? getComputedStyle(splash).getPropertyValue("--split").trim() : "";
    const bg = splash ? getComputedStyle(splash).backgroundColor : "";
    return {
      hasSplash: !!splash,
      hasVideo: !!video,
      hasSkip: !!skip,
      open,
      src: video?.getAttribute("src") ?? "",
      time: video ? video.currentTime : -1,
      paused: video ? video.paused : true,
      ready: video ? video.readyState : 0,
      split,
      bg,
      htmlClass: document.documentElement.className,
      hasHome: !!document.querySelector(".rbt-app"),
    };
  });
}

async function waitTime(page, t) {
  await page.waitForFunction(
    (target) => {
      const v = document.querySelector(".splash-video");
      return v && !v.paused && v.currentTime >= target;
    },
    t,
    { timeout: 8000 },
  );
}

const desk = await open({ width: 1440, height: 900 });
const report = { desktop: {}, mobile: {}, errors: [...desk.errors] };

await desk.page.waitForSelector(".splash-video", { timeout: 8000, state: "attached" });
await desk.page.evaluate(() => document.querySelector(".splash-video")?.play?.());

await waitTime(desk.page, 0.15);
report.desktop.start = await sample(desk.page);
await desk.page.screenshot({
  path: "/workspace/screenshots/vid-00-start.jpg",
  type: "jpeg",
  quality: 70,
  timeout: 10000,
});

await waitTime(desk.page, 0.9);
report.desktop.logo = await sample(desk.page);
await desk.page.screenshot({
  path: "/workspace/screenshots/vid-01-logo.jpg",
  type: "jpeg",
  quality: 70,
  timeout: 10000,
});

await waitTime(desk.page, 1.55);
report.desktop.bolt = await sample(desk.page);
await desk.page.screenshot({
  path: "/workspace/screenshots/vid-02-bolt.jpg",
  type: "jpeg",
  quality: 70,
  timeout: 10000,
});

await waitTime(desk.page, 2.28);
report.desktop.crack = await sample(desk.page);
await desk.page.screenshot({
  path: "/workspace/screenshots/vid-03-split.jpg",
  type: "jpeg",
  quality: 72,
  timeout: 10000,
});

await waitTime(desk.page, 2.55).catch(() => {});
report.desktop.wide = await sample(desk.page);
await desk.page.screenshot({
  path: "/workspace/screenshots/vid-03b-wide.jpg",
  type: "jpeg",
  quality: 72,
  timeout: 10000,
});

await desk.page.waitForFunction(() => !document.querySelector(".splash"), { timeout: 5000 }).catch(() => {});
await desk.page.waitForTimeout(200);
report.desktop.after = await sample(desk.page);
await desk.page.screenshot({
  path: "/workspace/screenshots/vid-04-home.jpg",
  type: "jpeg",
  quality: 70,
  timeout: 10000,
});
await desk.context.close();

const skipC = await open({ width: 1280, height: 800 });
await skipC.page.waitForSelector(".splash-video", { timeout: 8000, state: "attached" });
await skipC.page.evaluate(() => document.querySelector(".splash-skip")?.click());
await skipC.page.waitForTimeout(400);
report.skip = await sample(skipC.page);
await skipC.page.screenshot({
  path: "/workspace/screenshots/vid-skip.jpg",
  type: "jpeg",
  quality: 70,
  timeout: 10000,
});
await skipC.context.close();

const mob = await open({ width: 390, height: 844 });
await mob.page.waitForSelector(".splash-video", { timeout: 8000, state: "attached" });
await mob.page.evaluate(() => document.querySelector(".splash-video")?.play?.());
await waitTime(mob.page, 0.5).catch(() => {});
report.mobile = await sample(mob.page);
await mob.page.screenshot({
  path: "/workspace/screenshots/vid-m-logo.jpg",
  type: "jpeg",
  quality: 70,
  timeout: 10000,
});
await waitTime(mob.page, 2.48).catch(() => {});
report.mobileSplit = await sample(mob.page);
await mob.page.screenshot({
  path: "/workspace/screenshots/vid-m-split.jpg",
  type: "jpeg",
  quality: 72,
  timeout: 10000,
});
await mob.context.close();

await writeFile("/workspace/screenshots/vid-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
