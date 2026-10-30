import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ro-RO" });
await context.addInitScript(() => {
  localStorage.setItem("rabotaem-lang", "ro");
  sessionStorage.setItem("rabotaem-splash-v3", "1");
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.locator("[data-testid=oficial-home]").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.locator("[data-testid=oficial-home]").screenshot({ path: "/workspace/screenshots/kinds-oficial-band.png" });

const firstOficial = page.locator("[data-testid=oficial-home] a[href*='/jobs/']").first();
if (await firstOficial.count()) {
  await firstOficial.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "/workspace/screenshots/kinds-oficial-job.png", fullPage: true });
}

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
const firstRapid = page.locator("#joburi a[href*='/jobs/']").first();
await firstRapid.click();
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/kinds-rapid-job.png", fullPage: true });

await page.goto("http://127.0.0.1:8080/angajare", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/kinds-angajare.png", fullPage: true });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ro-RO" });
await mobile.addInitScript(() => {
  localStorage.setItem("rabotaem-lang", "ro");
  sessionStorage.setItem("rabotaem-splash-v3", "1");
});
const m = await mobile.newPage();
await m.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await m.waitForTimeout(400);
await m.screenshot({ path: "/workspace/screenshots/kinds-home-mobile-fold.png" });
await browser.close();
console.log("ok");
