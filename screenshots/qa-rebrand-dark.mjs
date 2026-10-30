import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";
const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  sessionStorage.setItem("rabotaem-splash", "1");
  localStorage.setItem("rabotaem-lang", "ro");
  localStorage.setItem("rabotaem-theme", "dark");
  document.documentElement.classList.add("dark");
});
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.evaluate(() => {
  document.documentElement.classList.add("dark");
  document.documentElement.style.colorScheme = "dark";
  localStorage.setItem("rabotaem-theme", "dark");
});
await page.waitForTimeout(500);
const info = await page.evaluate(() => ({
  dark: document.documentElement.classList.contains("dark"),
  theme: localStorage.getItem("rabotaem-theme"),
  bg: getComputedStyle(document.body).backgroundColor,
}));
console.log(info);
await page.screenshot({ path: `${OUT}/rebrand-home-dark.png` });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/rebrand-footer-dark.png` });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => {
  document.documentElement.classList.add("dark");
  document.documentElement.style.colorScheme = "dark";
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/rebrand-login-dark.png` });

const ctx2 = await browser.newContext({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 3 });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}/favicon.svg`);
await p2.setViewportSize({ width: 64, height: 64 });
await p2.screenshot({ path: `${OUT}/rebrand-favicon.png` });
console.log("ok");
await browser.close();
