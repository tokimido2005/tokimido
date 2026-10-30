import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function shot(name, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 900 },
    locale: "ro-RO",
    colorScheme: "dark",
    hasTouch: Boolean(opts.mobile),
    isMobile: Boolean(opts.mobile),
  });
  if (!opts.splash) {
    await context.addInitScript(() => {
      localStorage.setItem("rabotaem-lang", "ro");
      sessionStorage.setItem("rabotaem-splash-v3", "1");
    });
  } else {
    await context.addInitScript(() => {
      localStorage.setItem("rabotaem-lang", "ro");
      sessionStorage.removeItem("rabotaem-splash-v3");
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  await page.goto(base + (opts.path || "/"), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(opts.wait || 900);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: Boolean(opts.full) });
  const info = await page.evaluate(() => {
    const dark = document.documentElement.classList.contains("dark");
    const splash = !!document.querySelector(".splash");
    const hero = document.querySelector("h1")?.innerText || "";
    const steps = [...document.querySelectorAll("h3")].map((n) => n.innerText).slice(0, 6);
    const ctas = [...document.querySelectorAll("a,button")].map((n) => n.innerText.trim()).filter(Boolean).slice(0, 12);
    const cards = document.querySelectorAll("a.job-card").length;
    const glassOnHero = !!document.querySelector("section .glass");
    const fab = document.querySelector('[data-testid="chat-fab"]');
    const fabBox = fab ? fab.getBoundingClientRect() : null;
    const tab = document.querySelector(".tab-bar");
    const tabBox = tab ? tab.getBoundingClientRect() : null;
    return {
      dark,
      splash,
      hero,
      steps,
      ctas,
      cards,
      glassOnHero,
      fabY: fabBox && Math.round(fabBox.bottom),
      tabY: tabBox && Math.round(tabBox.top),
      theme: document.documentElement.style.colorScheme,
    };
  });
  console.log(name, JSON.stringify(info));
  await context.close();
  return info;
}

await shot("premium-splash", { splash: true, wait: 400, full: true });
await shot("premium-home", { wait: 1200, full: true });
await shot("premium-mobile", {
  wait: 1400,
  full: true,
  mobile: true,
  viewport: { width: 390, height: 844 },
});

const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ro-RO", colorScheme: "dark" });
await context.addInitScript(() => {
  localStorage.setItem("rabotaem-lang", "ro");
  sessionStorage.setItem("rabotaem-splash-v3", "1");
});
const page = await context.newPage();
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
const href = await page.locator("a.job-card").first().getAttribute("href");
if (href) {
  await page.goto(base + href, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/workspace/screenshots/premium-job.png", fullPage: false });
  const apply = await page.locator('[data-testid="apply-btn"], [data-testid="apply-btn-top"]').first();
  console.log("APPLY CLASS", await apply.getAttribute("class"));
}
await browser.close();
