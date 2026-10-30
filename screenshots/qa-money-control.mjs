import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const ADMIN_EMAIL = "tokimido@rabotaem.md";
const ADMIN_PASS = "Nascutinanul2005-";
const uid = String(Date.now()).slice(-7);
const email = `money${uid}@jobpeloc.test`;
const phone = `068${uid.slice(0, 6)}`;
const password = "Parola123";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = {};

function boot() {
  return {
    sessionStorage: { "rabotaem-splash-v3": "1", "rabotaem-splash": "1" },
    localStorage: { "rabotaem-lang": "en", "rabotaem-onboarded": "1", "rabotaem-theme": "light" },
  };
}

async function newPage(label, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((data) => {
    try {
      for (const [k, v] of Object.entries(data.sessionStorage)) sessionStorage.setItem(k, v);
      for (const [k, v] of Object.entries(data.localStorage)) localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  }, boot());
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(label, "PAGEERROR", e.message.slice(0, 220)));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(label, "CONSOLE", m.text().slice(0, 180));
  });
  return { page, context };
}

async function api(page, path, body) {
  return page.evaluate(async ({ path, body }) => {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return { status: r.status, text: (await r.text()).slice(0, 280) };
  }, { path, body });
}

async function saveMode(page) {
  await page.locator('[data-testid="money-save"]').click();
  const dialog = page.locator('[role="dialog"]');
  try {
    await dialog.waitFor({ timeout: 1800 });
    await dialog.getByRole("button", { name: /Save and apply|Salvează|Сохранить/i }).click();
  } catch {
    /* no confirm when only price/limits change */
  }
  await page.waitForTimeout(1400);
}

const { page, context } = await newPage("ADMIN");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(2400);
results.adminSign = await api(page, "/api/auth/sign-in/email", {
  email: ADMIN_EMAIL,
  password: ADMIN_PASS,
});
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="overview-mode"]', { timeout: 20000 });
results.overviewMode = await page.locator('[data-testid="overview-mode"]').getAttribute("data-mode");
results.overviewPills = await page.locator('[data-testid="overview-mode-pills"]').innerText();
await page.screenshot({ path: "/workspace/screenshots/money-overview.png", fullPage: true });

await page.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="money-active-mode"]', { timeout: 20000 });
results.activeStart = await page.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
results.liveBadge = await page.locator('[data-testid="money-live-badge"]').count();
results.hasFree = (await page.locator('[data-testid="money-mode-free"]').count()) > 0;
results.hasFreemium = (await page.locator('[data-testid="money-mode-freemium"]').count()) > 0;
results.hasPaid = (await page.locator('[data-testid="money-mode-paid"]').count()) > 0;
results.priceStart = await page.locator('[data-testid="money-price"]').inputValue();
await page.screenshot({ path: "/workspace/screenshots/money-tab-free.png", fullPage: true });

await page.locator('[data-testid="money-mode-freemium"]').click();
await page.locator('[data-testid="money-price"]').fill("79");
await page.locator('[data-testid="money-job-limit"]').fill("3");
await page.locator('[data-testid="money-apply-limit"]').fill("8");
results.unsaved = (await page.locator('[data-testid="money-unsaved"]').count()) > 0;
results.impactFreemium = await page.locator('[data-testid="money-impact"]').innerText();
await saveMode(page);
results.activeFreemium = await page.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
results.freemiumText = await page.locator('[data-testid="money-active-mode"]').innerText();
results.logRows = await page.locator('[data-testid="money-log-row"]').count();
results.priceAfter = await page.locator('[data-testid="money-price"]').inputValue();
await page.screenshot({ path: "/workspace/screenshots/money-tab-freemium.png", fullPage: true });

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
results.homeFreemium = /Free, with Pro|Gratuit, cu Pro|Бесплатно \+ Pro/i.test(await page.locator("main").innerText());
await page.screenshot({ path: "/workspace/screenshots/money-home-freemium.png", fullPage: true });

await page.goto(`${BASE}/pro`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="pro-card"]', { timeout: 15000 });
await page.waitForFunction(() => {
  const el = document.querySelector('[data-testid="pro-card"]');
  return el && /79/.test(el.textContent || "");
}, { timeout: 8000 }).catch(() => {});
results.proCard = await page.locator('[data-testid="pro-card"]').innerText();
results.proHas79 = /79/.test(results.proCard);
await page.screenshot({ path: "/workspace/screenshots/money-pro-page.png", fullPage: true });

await page.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="money-mode-paid"]', { timeout: 15000 });
await page.locator('[data-testid="money-mode-paid"]').click();
await saveMode(page);
results.activePaid = await page.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
results.impactPaid = await page.locator('[data-testid="money-impact"]').innerText();
await page.screenshot({ path: "/workspace/screenshots/money-tab-paid.png", fullPage: true });

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="overview-mode"]', { timeout: 15000 });
results.overviewPaid = await page.locator('[data-testid="overview-mode"]').getAttribute("data-mode");
results.overviewPaidText = await page.locator('[data-testid="overview-mode"]').innerText();
await page.screenshot({ path: "/workspace/screenshots/money-overview-paid.png", fullPage: true });

await page.goto(`${BASE}/admin?tab=log`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: /^Monetization$|^Monetizare$|^Монетизация$/ }).click();
await page.waitForTimeout(800);
results.logFilter = (await page.locator("main").innerText()).slice(0, 400);
await page.screenshot({ path: "/workspace/screenshots/money-admin-log.png", fullPage: true });
await context.close();

const { page: user, context: userCtx } = await newPage("USER");
await user.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
await user.waitForTimeout(2400);
results.signup = await api(user, "/api/auth/sign-up/email", { name: "Ion Money", email, password });
results.signin = await api(user, "/api/auth/sign-in/email", { email, password });
await user.goto(`${BASE}/complete`, { waitUntil: "domcontentloaded" });
try {
  await user.getByTestId("complete-phone").waitFor({ timeout: 12000 });
  await user.getByTestId("complete-phone").fill(phone);
  await user.evaluate(() => document.querySelector('button[role="checkbox"]')?.click());
  await user.waitForTimeout(200);
  await user.getByTestId("complete-submit").click({ force: true });
  await user.waitForFunction(() => !location.pathname.includes("/complete"), { timeout: 12000 }).catch(() => {});
} catch (err) {
  results.completeErr = String(err).slice(0, 160);
}
await user.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await user.waitForTimeout(1400);
if ((await user.getByTestId("sms-preview").count()) > 0) {
  const preview = await user.getByTestId("sms-preview").innerText();
  const code = preview.match(/(\d{6})/);
  if (code) {
    await user.getByTestId("sms-code").fill(code[1]);
    await user.getByRole("button", { name: /Verifică|Verify|Проверить/i }).click();
    await user.waitForTimeout(1600);
  }
}
await user.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await user.waitForTimeout(1400);
results.postUrl = user.url();
results.paywall = (await user.getByTestId("paywall").count()) > 0;
results.paywallMode = await user.getByTestId("paywall").getAttribute("data-mode").catch(() => null);
await user.screenshot({ path: "/workspace/screenshots/money-user-paid.png", fullPage: true });
await userCtx.close();

const { page: admin2, context: admin2Ctx } = await newPage("ADMIN2");
await admin2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await admin2.waitForTimeout(2400);
await api(admin2, "/api/auth/sign-in/email", { email: ADMIN_EMAIL, password: ADMIN_PASS });
await admin2.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
await admin2.waitForSelector('[data-testid="money-mode-free"]', { timeout: 15000 });
await admin2.locator('[data-testid="money-mode-free"]').click();
await saveMode(admin2);
results.restored = await admin2.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
results.logRowsEnd = await admin2.locator('[data-testid="money-log-row"]').count();
await admin2.screenshot({ path: "/workspace/screenshots/money-tab-restored.png", fullPage: true });
await admin2Ctx.close();

const { page: mobile, context: mobileCtx } = await newPage("MOBILE", { width: 390, height: 844 });
await mobile.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await mobile.waitForTimeout(2400);
await api(mobile, "/api/auth/sign-in/email", { email: ADMIN_EMAIL, password: ADMIN_PASS });
await mobile.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
await mobile.waitForSelector('[data-testid="money-active-mode"]', { timeout: 15000 });
results.mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
results.mobileMode = await mobile.locator('[data-testid="money-active-mode"]').innerText();
await mobile.screenshot({ path: "/workspace/screenshots/money-mobile.png", fullPage: true });
await mobileCtx.close();

await browser.close();
console.log(JSON.stringify(results, null, 2));
