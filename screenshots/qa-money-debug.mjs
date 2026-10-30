import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(() => {
  try {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-onboarded", "1");
  } catch {}
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGEERROR", e.message);
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

await page.goto("http://127.0.0.1:8080/login?next=/admin", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(500);
const loginInput = page.locator("input").first();
await loginInput.fill("tokimido");
await page.locator('input[type="password"]').fill("Nascutinanul2005-");
await page.getByRole("button", { name: /Intră|Войти|Sign in/i }).click();
await page.waitForURL(/\/admin/, { timeout: 20000 });
await page.waitForTimeout(2500);
console.log("url", page.url());
console.log("errors", errors);
const nav = await page.locator("nav").innerText().catch(() => "NO NAV");
console.log("NAV:\n", nav);
const main = await page.locator("main").innerText();
console.log("MAIN:\n", main.slice(0, 800));
console.log("has overview-mode", await page.locator("[data-testid=overview-mode]").count());
console.log("has money tab link", await page.locator('a[href*="tab=money"]').count());
await page.screenshot({ path: "/workspace/screenshots/money-debug.png", fullPage: true });
await browser.close();
