import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "no-preference",
});
await context.addInitScript(() => {
  for (const k of ["v4", "v5", "v6", "v7", "v8", "v9"]) {
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
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console:" + m.text());
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1200);
const info = await page.evaluate(() => ({
  html: document.documentElement.className,
  splash: !!document.querySelector(".splash"),
  videoCount: document.querySelectorAll("video").length,
  splashHtml: document.querySelector(".splash")?.outerHTML?.slice(0, 800) ?? "",
  bodyStart: document.body.innerHTML.slice(0, 400),
}));
console.log(JSON.stringify({ errors, info }, null, 2));
await browser.close();
