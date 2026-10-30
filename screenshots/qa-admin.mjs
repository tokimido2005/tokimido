import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(() => {
  try {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-onboarded", "1");
  } catch {
    /* ignore */
  }
});
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});

async function shot(name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}`, fullPage: true });
}

await page.goto("http://127.0.0.1:8080/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(1200);
console.log("unauth admin url", page.url());
await shot("admin-unauth.png");

const loginInput = page.locator('input[autocomplete="username"], input[placeholder*="utilizator"], input[placeholder*="Email"]').first();
await loginInput.waitFor({ timeout: 15000 });
await loginInput.fill("tokimido");
await page.locator('input[type="password"]').fill("Nascutinanul2005-");
await page.getByRole("button", { name: /Intră|Войти|Sign in/i }).click();
await page.waitForTimeout(2500);
console.log("after login url", page.url());
await shot("admin-after-login.png");

const onAdmin = page.url().includes("/admin");
console.log("landed on admin", onAdmin);

if (!onAdmin) {
  const err = await page.locator("p.text-danger, .text-danger").textContent().catch(() => "");
  console.log("login error", err);
}

await page.waitForSelector("h1", { timeout: 15000 });
const h1 = await page.locator("h1").first().innerText();
console.log("h1", h1);

const stats = await page.locator("a.glass p.text-3xl, a p.text-3xl").allInnerTexts();
console.log("stats", stats);

await shot("admin-overview.png");

await page.getByRole("link", { name: /Anunțuri|Объявления|Listings/i }).first().click();
await page.waitForTimeout(800);
console.log("jobs tab", page.url());
const jobCount = await page.locator("article").count();
console.log("job cards", jobCount);
await shot("admin-jobs.png");

if (jobCount > 0) {
  const hideBtn = page.getByRole("button", { name: /Ascunde|Скрыть|Hide/i }).first();
  if (await hideBtn.count()) {
    await hideBtn.click();
    await page.waitForTimeout(600);
    console.log("hid first job");
  }
}

await page.getByRole("link", { name: /Utilizatori|Пользователи|Users/i }).first().click();
await page.waitForTimeout(800);
const userText = await page.locator("main").innerText();
console.log("users has tokimido", /tokimido/i.test(userText));
await shot("admin-users.png");

await page.getByRole("link", { name: /Rapoarte|Жалобы|Reports/i }).first().click();
await page.waitForTimeout(600);
await shot("admin-reports.png");

await page.getByRole("link", { name: /Mesaje|Сообщения|Messages/i }).first().click();
await page.waitForTimeout(600);
await shot("admin-messages.png");

await page.getByRole("link", { name: /Jurnal|Журнал|Activity/i }).first().click();
await page.waitForTimeout(800);
const logText = await page.locator("main").innerText();
console.log("log has hide", /job\.hide|job.hide/.test(logText));
await shot("admin-log.png");

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:8080/admin", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await shot("admin-mobile.png");

const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await guest.addInitScript(() => {
  try {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-onboarded", "1");
  } catch {
    /* ignore */
  }
});
const g = await guest.newPage();
await g.goto("http://127.0.0.1:8080/admin", { waitUntil: "domcontentloaded" });
await g.waitForTimeout(1200);
console.log("guest admin url", g.url());
await g.screenshot({ path: "/workspace/screenshots/admin-guest.png" });
await guest.close();

await browser.close();
console.log("done");
