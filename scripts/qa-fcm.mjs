import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
const VAPID =
  "BPyUgJBqEXs8yeBzlWbtE960jO3b8uxDVYBF1IwtANd5H_5RMBUhlA1U2XW4wQPX9P4_nEdDmJWmC4_M50yxByM";
const PROJECT = "rabotaem-79c83";

await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const errors = [];

async function checkPage(path, shot, viewport) {
  const context = await browser.newContext({
    viewport: viewport ?? { width: 1280, height: 800 },
    serviceWorkers: "allow",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  const status = res?.status() ?? 0;
  const bodyText = await page.locator("body").innerText().catch(() => "");
  await page.screenshot({ path: `/workspace/screenshots/${shot}`, fullPage: true });
  const sw = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false };
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      supported: true,
      scopes: regs.map((r) => r.scope),
      scripts: regs.map((r) => r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ""),
    };
  });
  await context.close();
  return { path, status, hasText: bodyText.length > 40, consoleErrors, sw };
}

const fcmSw = await fetch(base + "/firebase-messaging-sw.js").then(async (r) => ({
  status: r.status,
  text: await r.text(),
}));
const mainSw = await fetch(base + "/sw.js").then(async (r) => ({
  status: r.status,
  text: await r.text(),
}));

const home = await checkPage("/", "fcm-home.png");
const mobile = await checkPage("/", "fcm-home-mobile.png", { width: 390, height: 844 });
const login = await checkPage("/login", "fcm-login.png");

const report = {
  fcmSw: {
    status: fcmSw.status,
    hasProject: fcmSw.text.includes(PROJECT),
    hasVapid: fcmSw.text.includes(VAPID),
    hasApiKey: fcmSw.text.includes("AIzaSyBL5adQ7l19NL-p9sBuIIPflf0xwQOT0jM"),
    hasAppId: fcmSw.text.includes("1:763180806225:web:ece668a30b8727f0c78870"),
  },
  mainSw: {
    status: mainSw.status,
    cache: /rabotaem-static-v3/.test(mainSw.text),
    bypassFcm: mainSw.text.includes("firebase-messaging-sw.js"),
    hasPush: mainSw.text.includes('addEventListener("push"'),
  },
  home,
  mobile,
  login,
};

console.log(JSON.stringify(report, null, 2));

const fatal = [];
if (!report.fcmSw.hasProject || !report.fcmSw.hasVapid) fatal.push("FCM SW missing credentials");
if (home.status !== 200 || !home.hasText) fatal.push("home failed");
if (home.consoleErrors.length) fatal.push("home console: " + home.consoleErrors.join(" | "));
if (mobile.consoleErrors.length) fatal.push("mobile console: " + mobile.consoleErrors.join(" | "));
if (fatal.length) {
  console.error("FAIL", fatal);
  process.exit(1);
}
await browser.close();
console.log("OK");
