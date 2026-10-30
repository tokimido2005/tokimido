import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const boot = {
  sessionStorage: { "rabotaem-splash-v3": "1", "rabotaem-splash": "1" },
  localStorage: { "rabotaem-lang": "en", "rabotaem-onboarded": "1", "rabotaem-theme": "light" },
};

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript((d) => {
  for (const [k, v] of Object.entries(d.sessionStorage)) sessionStorage.setItem(k, v);
  for (const [k, v] of Object.entries(d.localStorage)) localStorage.setItem(k, v);
}, boot);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 220)));

const out = {};

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(2200);
out.sign = await page.evaluate(async () => {
  const r = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" }),
  });
  return r.status;
});

await page.goto(`${BASE}/admin?tab=jobs`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="demo-generate"]', { timeout: 20000 });
out.hasGenerate = true;
out.hasDelete = (await page.locator('[data-testid="demo-delete"]').count()) > 0;

await page.locator('[data-testid="demo-generate"]').click();
await page.waitForTimeout(2500);
out.badges = await page.locator('[data-testid="demo-badge"]').count();
out.adminTitles = await page.locator("article[data-demo='true'] a").allInnerTexts();
await page.screenshot({ path: "/workspace/screenshots/demo-admin-jobs.png", fullPage: true });

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const home = await page.locator("main").innerText();
out.homeHasDemoTitle = out.adminTitles.some((t) => home.includes(t));
out.homeHasDemoWord = /demo listing|anunțuri demo|демо-объяв/i.test(home);
await page.screenshot({ path: "/workspace/screenshots/demo-home.png", fullPage: true });

const firstTitle = out.adminTitles[0];
if (firstTitle) {
  const card = page.getByRole("link", { name: firstTitle }).first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(1200);
    out.jobPageTitle = await page.locator("h1").innerText().catch(() => "");
    out.jobPageHasDemo = /demo listing|anunț demo|демо/i.test(await page.locator("main").innerText());
    await page.screenshot({ path: "/workspace/screenshots/demo-job-page.png", fullPage: true });
  }
}

await page.goto(`${BASE}/admin?tab=jobs`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="demo-delete"]', { timeout: 15000 });
await page.getByRole("button", { name: /^Demo$/ }).click().catch(() => {});
await page.waitForTimeout(400);
await page.locator('[data-testid="demo-delete"]').click();
const dialog = page.locator('[role="dialog"]');
await dialog.waitFor({ timeout: 4000 });
await dialog.getByRole("button", { name: /Delete all demo|Șterge toate|Удалить все/i }).click();
await page.waitForTimeout(2000);
out.badgesAfter = await page.locator('[data-testid="demo-badge"]').count();
await page.screenshot({ path: "/workspace/screenshots/demo-admin-cleared.png", fullPage: true });

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
out.overview = (await page.locator("main").innerText()).slice(0, 400);
await page.screenshot({ path: "/workspace/screenshots/demo-overview.png", fullPage: true });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
await mobile.addInitScript((d) => {
  for (const [k, v] of Object.entries(d.sessionStorage)) sessionStorage.setItem(k, v);
  for (const [k, v] of Object.entries(d.localStorage)) localStorage.setItem(k, v);
}, boot);
const m = await mobile.newPage();
await m.goto(BASE, { waitUntil: "domcontentloaded" });
await m.waitForTimeout(2200);
await m.evaluate(async () => {
  await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" }),
  });
});
await m.goto(`${BASE}/admin?tab=jobs`, { waitUntil: "domcontentloaded" });
await m.waitForSelector('[data-testid="demo-generate"]', { timeout: 15000 });
out.mobileOverflow = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
await m.screenshot({ path: "/workspace/screenshots/demo-mobile.png", fullPage: true });
await mobile.close();

await ctx.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
