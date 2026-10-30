import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function skipSplash(context) {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("rabotaem-splash", "1");
      localStorage.setItem("rabotaem-onboarded", "1");
    } catch {
      /* ignore */
    }
  });
}

const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await skipSplash(guest);
const g = await guest.newPage();
await g.goto("http://127.0.0.1:8080/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
await g.waitForURL(/login/, { timeout: 15000 });
console.log("guest redirected", g.url());
await g.screenshot({ path: "/workspace/screenshots/admin-guest2.png" });
const hasSignOut = await g.getByRole("button", { name: /Ieșire|Выйти|Sign out/i }).count();
console.log("guest signout buttons", hasSignOut);
await guest.close();

const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await skipSplash(context);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://127.0.0.1:8080/login", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.locator('input[autocomplete="username"]').waitFor({ timeout: 15000 });
await page.locator('input[autocomplete="username"]').fill("tokimido");
await page.locator('input[type="password"]').fill("Nascutinanul2005-");
await page.getByRole("button", { name: /Intră|Войти|Sign in/i }).click();
await page.waitForURL(/\/admin/, { timeout: 20000 });
console.log("admin url", page.url());
await page.waitForSelector("h1");
console.log("h1", await page.locator("h1").first().innerText());
const stats = await page.locator("a p.text-3xl").allInnerTexts();
console.log("stats", stats);
await page.screenshot({ path: "/workspace/screenshots/admin-overview2.png", fullPage: true });

await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const adminNav = await page.locator("header a", { hasText: /Admin|Админ/ }).count();
console.log("home admin nav", adminNav);
await page.screenshot({ path: "/workspace/screenshots/admin-home-nav.png" });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:8080/admin?tab=users", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.screenshot({ path: "/workspace/screenshots/admin-mobile-users.png", fullPage: true });

await browser.close();
console.log("ok");
