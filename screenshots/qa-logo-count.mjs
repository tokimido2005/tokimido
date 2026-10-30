import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  sessionStorage.setItem("rabotaem-splash", "1");
  localStorage.setItem("rabotaem-lang", "ro");
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(400);
const imgs = await page.locator("header img").evaluateAll((els) =>
  els.map((e) => ({
    alt: e.getAttribute("alt"),
    src: e.getAttribute("src"),
    display: getComputedStyle(e).display,
    w: e.getBoundingClientRect().width,
    h: e.getBoundingClientRect().height,
  })),
);
console.log(JSON.stringify(imgs, null, 2));
await browser.close();
