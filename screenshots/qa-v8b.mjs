import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const uid = String(Date.now()).slice(-7);
const email = `qc${uid}@jobpeloc.test`;
const email2 = `qd${uid}@jobpeloc.test`;
const phone = `067${uid.slice(0, 6)}`;
const password = "Parola123";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

function attach(page, label) {
  page.on("pageerror", (e) => console.log(label, "PAGEERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(label, "CONSOLE", m.text().slice(0, 200));
  });
}

async function boot(page, extra = {}) {
  await page.addInitScript((data) => {
    try {
      sessionStorage.setItem("jobpeloc-splash", "1");
      localStorage.setItem("jobpeloc-lang", "ro");
      localStorage.setItem("jobpeloc-theme", data.theme || "light");
      if (data.onboarded) localStorage.setItem("jobpeloc-onboarded", "1");
    } catch {
      /* ignore */
    }
  }, extra);
}

async function solveCaptcha(page) {
  await page.waitForFunction(
    () => {
      const el = [...document.querySelectorAll("span")].find((s) => (s.textContent || "").includes("= ?"));
      return Boolean(el && /\d+\s*\+\s*\d+/.test(el.textContent || ""));
    },
    { timeout: 15000 },
  );
  const text = await page.locator("span").filter({ hasText: "= ?" }).first().innerText();
  const m = text.match(/(\d+)\s*\+\s*(\d+)/);
  await page.getByPlaceholder("Răspuns").fill(String(Number(m[1]) + Number(m[2])));
}

async function acceptRules(page) {
  const box = page.locator('button[role="checkbox"]');
  await box.click();
  const checked = await box.getAttribute("aria-checked");
  if (checked !== "true") await box.click({ force: true });
}

async function signup(page, { first, last, phone: tel, email: mail }) {
  await page.goto(`${BASE}/login?mode=up`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(500);
  await page.getByPlaceholder("Prenume", { exact: true }).fill(first);
  await page.getByPlaceholder("Nume", { exact: true }).fill(last);
  await page.getByPlaceholder("Telefon", { exact: true }).fill(tel);
  await page.getByPlaceholder("Email", { exact: true }).fill(mail);
  await page.getByPlaceholder(/Parolă/).fill(password);
  await acceptRules(page);
  await solveCaptcha(page);
  const btn = page.getByRole("button", { name: "Creează cont" });
  await btn.waitFor({ state: "visible" });
  if (await btn.isDisabled()) {
    await acceptRules(page);
  }
  await btn.click({ timeout: 10000 });
}

const results = {};
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page, "A");
await boot(page);

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 45000 }).catch(() =>
  page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 }),
);
await page.waitForTimeout(900);
results.homeJobs = await page.locator("#joburi a[href^='/jobs/']").count();
await page.screenshot({ path: "/workspace/screenshots/v8-home-clean.png", fullPage: true });

await signup(page, { first: "Ana", last: "Tester", phone, email });
try {
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 20000 });
} catch {
  results.signupStay = await page.locator("body").innerText();
}
await page.waitForTimeout(1200);
results.onboardVisible = await page.locator('[role="dialog"]').filter({ hasText: "Bun venit" }).isVisible().catch(() => false);
if (!results.onboardVisible) {
  results.onboardVisible = (await page.locator("body").innerText()).includes("Găsește joburi lângă tine");
}
await page.screenshot({ path: "/workspace/screenshots/v8-onboard2.png" });
if (results.onboardVisible) {
  await page.getByRole("button", { name: "Sari" }).click();
  await page.waitForTimeout(300);
}
results.onboardClosed = !(await page.getByRole("button", { name: "Sari" }).isVisible().catch(() => false));

await page.goto(`${BASE}/u/seed-jobpeloc`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(800);
results.blockBtn = await page.getByRole("button", { name: "Blochează" }).count();
if (results.blockBtn) {
  await page.getByRole("button", { name: "Blochează" }).click();
  await page.waitForTimeout(900);
  results.blocked = (await page.locator("body").innerText()).toLowerCase().includes("blocat");
}
await page.screenshot({ path: "/workspace/screenshots/v8-block2.png" });
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(4000);
results.jobsAfterBlock = await page.locator("#joburi a[href^='/jobs/']").count();
results.afterText = (await page.locator("#joburi p").first().innerText().catch(() => ""));
results.homeAuth = (await page.locator("header").innerText()).slice(0, 200);
await page.screenshot({ path: "/workspace/screenshots/v8-blocked-home.png" });

try {
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  attach(page2, "B");
  await boot(page2, { onboarded: true });
  await signup(page2, { first: "Ion", last: "Dublu", phone, email: email2 });
  await page2.waitForTimeout(1500);
  const body = (await page2.locator("body").innerText()).toLowerCase();
  results.uniquePhone = body.includes("deja") || body.includes("folosit");
  results.uniquePhoneBody = body.slice(0, 400);
  await page2.screenshot({ path: "/workspace/screenshots/v8-unique-phone.png" });
  await page2.close();
} catch (err) {
  results.uniquePhoneError = err instanceof Error ? err.message.slice(0, 400) : String(err);
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
