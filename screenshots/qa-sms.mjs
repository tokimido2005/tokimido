import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const uid = String(Date.now()).slice(-7);
const email = `sms${uid}@jobpeloc.test`;
const phone = `069${uid.slice(0, 6)}`;
const password = "Parola123";
const ADMIN_USER = "tokimido";
const ADMIN_PASS = "Nascutinanul2005-";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = {};

function boot() {
  return {
    sessionStorage: { "rabotaem-splash-v3": "1" },
    localStorage: { "rabotaem-lang": "ro", "rabotaem-onboarded": "1", "rabotaem-theme": "light" },
  };
}

async function newPage(label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
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

const { page: guest, context: guestCtx } = await newPage("GUEST");
await guest.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
await guest.waitForTimeout(600);
results.forgot = await guest.getByTestId("forgot-password").innerText().catch(() => "");
await guest.getByTestId("forgot-password").click();
await guest.waitForTimeout(700);
results.resetUrl = guest.url();
results.resetScreen = (await guest.getByTestId("reset-screen").count()) > 0;
await guest.screenshot({ path: "/workspace/artifacts/qa-sms-reset.png", fullPage: true });

await guest.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await guest.waitForFunction(() => location.pathname.includes("/login"), { timeout: 12000 }).catch(() => {});
results.postGuest = guest.url();

await guest.goto(`${BASE}/verify`, { waitUntil: "domcontentloaded" });
await guest.waitForTimeout(800);
results.verifyGuest = guest.url();
await guestCtx.close();

const { page, context } = await newPage("USER");
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
results.signup = await api(page, "/api/auth/sign-up/email", {
  name: "Ana Sms",
  email,
  password,
});
results.signin = await api(page, "/api/auth/sign-in/email", { email, password });
await page.goto(`${BASE}/complete`, { waitUntil: "domcontentloaded" });
await page.getByTestId("complete-phone").waitFor({ timeout: 15000 });
await page.getByTestId("complete-phone").fill(phone);
await page.evaluate(() => document.querySelector('button[role="checkbox"]')?.click());
await page.waitForTimeout(200);
await page.getByTestId("complete-submit").click({ force: true });
await page.waitForFunction(() => !location.pathname.includes("/complete"), { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
results.afterComplete = page.url();

await page.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);
results.postUrl = page.url();
results.verifyScreen = (await page.getByTestId("verify-screen").count()) > 0;
results.lockedPhone = (await page.getByTestId("phone-locked").count()) > 0;
results.preview = await page.getByTestId("sms-preview").innerText().catch(() => "");
await page.screenshot({ path: "/workspace/artifacts/qa-sms-verify.png", fullPage: true });

const codeMatch = results.preview.match(/(\d{6})/);
if (codeMatch) {
  await page.getByTestId("sms-code").fill("000000");
  await page.getByRole("button", { name: /Verifică/i }).click();
  await page.waitForTimeout(600);
  results.wrongCode = await page.locator("p.text-danger").innerText().catch(() => "");
  await page.getByTestId("sms-code").fill(codeMatch[1]);
  await page.getByRole("button", { name: /Verifică/i }).click();
  await page.waitForTimeout(1800);
  results.afterVerify = page.url();
}

await page.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
results.postAfterVerify = page.url();
results.postForm = (await page.getByRole("heading", { name: /Postez un job/i }).count()) > 0;
results.postLocked = (await page.getByTestId("phone-locked").count()) > 0;
await page.screenshot({ path: "/workspace/artifacts/qa-sms-post.png", fullPage: true });
await context.close();

const { page: admin, context: adminCtx } = await newPage("ADMIN");
await admin.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
results.adminSign = await api(admin, "/api/auth/sign-in/email", {
  email: "tokimido@rabotaem.md",
  password: ADMIN_PASS,
});
await admin.goto(`${BASE}/admin?tab=sms`, { waitUntil: "domcontentloaded" });
await admin.waitForTimeout(1200);
results.adminSmsUrl = admin.url();
results.smsRows = await admin.getByTestId("sms-log-row").count();
results.adminSmsText = (await admin.locator("main").innerText()).slice(0, 400);
await admin.screenshot({ path: "/workspace/artifacts/qa-sms-admin.png", fullPage: true });
await adminCtx.close();

await browser.close();
console.log(JSON.stringify(results, null, 2));
