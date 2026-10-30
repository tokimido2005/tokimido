import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function open(viewport, extras = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: viewport.width < 800 ? 2 : 1,
    hasTouch: viewport.width < 800,
    isMobile: viewport.width < 800,
    reducedMotion: "no-preference",
    ...extras,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  const t0 = Date.now();
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector(".splash", { timeout: 8000 });
  return { context, page, errors, t0 };
}

async function info(page) {
  return page.evaluate(() => {
    const splash = document.querySelector(".splash");
    const logo = document.querySelector(".splash-logo");
    const tag = document.querySelector(".splash-tagline");
    const cs = splash ? getComputedStyle(splash) : null;
    const ls = logo ? getComputedStyle(logo) : null;
    return {
      hasSplash: !!splash,
      splashOut: splash?.classList.contains("splash-out") ?? false,
      hasLogo: !!logo,
      tag: tag?.textContent?.trim() ?? "",
      htmlClass: document.documentElement.className,
      splashBg: cs?.backgroundColor ?? "",
      logoBg: ls?.backgroundImage ?? "",
      logoFilter: ls?.filter ?? "",
      logoBox: logo ? logo.getBoundingClientRect().toJSON() : null,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
}

const desk = await open({ width: 1440, height: 900 });
await desk.page.waitForTimeout(200);
const desktopEarly = await info(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/splash-desk-080.png", fullPage: false });
await desk.page.waitForTimeout(500);
const desktopMid = await info(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/splash-desk-700.png", fullPage: false });
await desk.page.waitForTimeout(700);
const desktopHold = await info(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/splash-desk-1400.png", fullPage: false });
await desk.page.waitForTimeout(1200);
const desktopAfter = await info(desk.page);
await desk.page.screenshot({ path: "/workspace/screenshots/splash-desk-after.png", fullPage: false });
await desk.context.close();

const mob = await open({ width: 390, height: 844 });
await mob.page.waitForTimeout(600);
const mobileMid = await info(mob.page);
await mob.page.screenshot({ path: "/workspace/screenshots/splash-mob-700.png", fullPage: false });
await mob.page.waitForTimeout(2000);
const mobileAfter = await info(mob.page);
await mob.page.screenshot({ path: "/workspace/screenshots/splash-mob-after.png", fullPage: false });
await mob.context.close();

const red = await open({ width: 1280, height: 800 }, { reducedMotion: "reduce" });
await red.page.waitForTimeout(500);
const reduced = await info(red.page);
await red.page.screenshot({ path: "/workspace/screenshots/splash-desk-reduced.png", fullPage: false });
await red.context.close();

const report = {
  desktopEarly,
  desktopMid,
  desktopHold,
  desktopAfter,
  mobileMid,
  mobileAfter,
  reduced,
  deskErrors: desk.errors,
  mobErrors: mob.errors,
};
console.log(JSON.stringify(report, null, 2));
await writeFile("/workspace/screenshots/splash-desktop.json", JSON.stringify(report, null, 2));

const fatal = [];
if (!desktopEarly.hasSplash) fatal.push("desktop early splash missing");
if (!desktopMid.hasSplash) fatal.push("desktop mid splash missing");
if (!desktopHold.hasSplash && !desktopHold.splashOut) fatal.push("desktop hold splash missing");
if (desktopAfter.hasSplash && !desktopAfter.htmlClass.includes("rbt-splash-done")) {
  fatal.push("desktop splash did not dismiss");
}
if (!mobileMid.hasSplash) fatal.push("mobile splash missing");
if (mobileAfter.hasSplash && !mobileAfter.htmlClass.includes("rbt-splash-done")) {
  fatal.push("mobile splash did not dismiss");
}
if (!desktopMid.hasLogo) fatal.push("desktop logo missing");
if (desktopMid.tag !== "lucru pe loc. bani pe loc.") fatal.push("desktop tagline " + desktopMid.tag);
if (desktopMid.logoFilter && desktopMid.logoFilter !== "none") fatal.push("logo filter " + desktopMid.logoFilter);
if (!desktopMid.logoBg.includes("logo-splash")) fatal.push("logo image missing");
if (desktopMid.logoBox && (desktopMid.logoBox.width < 280 || desktopMid.logoBox.height < 60)) {
  fatal.push("desktop logo too small " + JSON.stringify(desktopMid.logoBox));
}
if (!reduced.hasSplash) fatal.push("reduced-motion splash missing");
if (fatal.length) {
  console.error("FAIL", fatal);
  process.exit(1);
}
await browser.close();
console.log("OK");
