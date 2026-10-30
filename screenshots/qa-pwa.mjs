import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const out = "/workspace/screenshots";
await mkdir(out, { recursive: true });
const errors = [];
const origin = "http://127.0.0.1:8080";

function check(cond, msg) {
  if (!cond) {
    errors.push(msg);
    console.log("FAIL", msg);
  } else {
    console.log("OK", msg);
  }
}

const manRes = await fetch(`${origin}/manifest.webmanifest`);
check(manRes.ok, "manifest 200");
const man = await manRes.json();
check(man.name === "Rabotaem.md", `name=${man.name}`);
check(man.short_name === "Rabotaem", `short_name=${man.short_name}`);
check(man.description === "Lucru pe loc. Bani pe loc.", `description=${man.description}`);
check(man.display === "standalone", `display=${man.display}`);
check(man.theme_color === "#0B2548", `theme=${man.theme_color}`);
check(man.background_color === "#0B2548", `bg=${man.background_color}`);
check(man.start_url === "/", `start=${man.start_url}`);
check(Array.isArray(man.icons) && man.icons.length >= 4, `icons=${man.icons?.length}`);
check(man.icons.some((i) => i.purpose === "maskable"), "has maskable icon");

for (const path of ["/icon-192.png", "/icon-512.png", "/icon-192-maskable.png", "/icon-512-maskable.png", "/apple-touch-icon.png", "/sw.js", "/offline.html"]) {
  const r = await fetch(`${origin}${path}`);
  check(r.ok, `${path} ${r.status}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
await page.addInitScript(() => {
  sessionStorage.setItem("rabotaem-splash", "1");
});
await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);

const head = await page.evaluate(() => {
  const manifests = [...document.querySelectorAll('link[rel="manifest"]')].map((el) => el.getAttribute("href"));
  const apples = [...document.querySelectorAll('link[rel="apple-touch-icon"]')].map((el) => el.getAttribute("href"));
  return {
    manifests,
    apples,
    capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
    theme: document.querySelector('meta[name="theme-color"]')?.content,
    viewport: document.querySelector('meta[name="viewport"]')?.content,
    status: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
  };
});
console.log("HEAD", head);
check(head.manifests[0] === "/manifest.webmanifest", "first manifest is ours");
check(head.manifests.includes("/__grok/manifest.webmanifest"), "grok manifest still linked");
check(head.apples.includes("/apple-touch-icon.png"), "apple touch icon branded");
check(head.capable === "yes", "apple-mobile-web-app-capable");
check(head.title === "Rabotaem" || head.title === "Rabotaem.md", `apple title ${head.title}`);
check(head.theme === "#0B2548", `theme ${head.theme}`);
check(String(head.viewport).includes("viewport-fit=cover"), "viewport-fit=cover");
check(head.status === "black-translucent", `status ${head.status}`);

const sw = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return { supported: false };
  const reg = await navigator.serviceWorker.ready;
  return {
    supported: true,
    scope: reg.scope,
    active: Boolean(reg.active),
    script: reg.active?.scriptURL ?? "",
  };
});
console.log("SW", sw);
check(sw.supported && sw.active, "service worker active");
check(String(sw.script).endsWith("/sw.js"), `script ${sw.script}`);

await page.screenshot({ path: `${out}/pwa-home-mobile.png` });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
check(!overflow, "no mobile overflow");
const fab = await page.getByTestId("chat-fab").isVisible();
check(fab, "chat still visible");

await page.goto(origin + "/offline.html", { waitUntil: "domcontentloaded" });
const offlineText = await page.locator("body").innerText();
check(offlineText.includes("offline") || offlineText.includes("Offline") || offlineText.includes("Ești offline"), "offline page text");
await page.screenshot({ path: `${out}/pwa-offline.png` });

await page.goto(origin + "/login", { waitUntil: "networkidle" });
const loginFab = await page.getByTestId("chat-fab").isVisible();
check(loginFab, "login still works");
await page.screenshot({ path: `${out}/pwa-login.png` });

await browser.close();
console.log("ERRORS", errors);
if (errors.length) process.exit(1);
