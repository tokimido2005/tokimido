import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const boot = {
  sessionStorage: { "rabotaem-splash-v3": "1", "rabotaem-splash": "1" },
  localStorage: { "rabotaem-lang": "en", "rabotaem-onboarded": "1", "rabotaem-theme": "light" },
};

async function open(w = 1280, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((d) => {
    for (const [k, v] of Object.entries(d.sessionStorage)) sessionStorage.setItem(k, v);
    for (const [k, v] of Object.entries(d.localStorage)) localStorage.setItem(k, v);
  }, boot);
  return { p: await ctx.newPage(), ctx };
}

async function api(p, path, body) {
  return p.evaluate(async ({ path, body }) => {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return r.status;
  }, { path, body });
}

async function save(p) {
  const btn = p.locator('[data-testid="money-save"]');
  if (await btn.isDisabled()) return;
  await btn.click();
  const d = p.locator('[role="dialog"]');
  try {
    await d.waitFor({ timeout: 1600 });
    await d.getByRole("button", { name: /Save and apply|Salvează|Сохранить/i }).click();
  } catch {
    /* no dialog */
  }
  await p.waitForTimeout(1200);
}

async function verifySms(p) {
  const preview = p.getByTestId("sms-preview");
  try {
    await preview.waitFor({ timeout: 8000 });
  } catch {
    return false;
  }
  const text = await preview.innerText();
  const code = text.match(/(\d{6})/);
  if (!code) return false;
  await p.getByTestId("sms-code").fill(code[1]);
  await p.getByRole("button", { name: /Verifică|Verify|Проверить/i }).click();
  await p.waitForTimeout(1600);
  return true;
}

const out = {};

try {
  const { p, ctx } = await open();
  await p.goto(BASE, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2200);
  out.admin = await api(p, "/api/auth/sign-in/email", { email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" });
  await p.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector('[data-testid="money-mode-paid"]', { timeout: 20000 });
  await p.locator('[data-testid="money-mode-paid"]').click();
  await save(p);
  out.paid = await p.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
  await ctx.close();

  const uid = String(Date.now()).slice(-6);
  const email = `wall${uid}@jobpeloc.test`;
  const { p: u, ctx: uc } = await open();
  try {
    await u.goto(BASE, { waitUntil: "domcontentloaded" });
    await u.waitForTimeout(2200);
    out.signup = await api(u, "/api/auth/sign-up/email", { name: "Ana Wall", email, password: "Parola123" });
    await api(u, "/api/auth/sign-in/email", { email, password: "Parola123" });
    await u.goto(`${BASE}/complete`, { waitUntil: "domcontentloaded" });
    await u.getByTestId("complete-phone").waitFor({ timeout: 12000 });
    await u.getByTestId("complete-phone").fill(`069${uid}`);
    await u.evaluate(() => document.querySelector('button[role="checkbox"]')?.click());
    await u.waitForTimeout(250);
    await u.getByTestId("complete-submit").click({ force: true });
    await u.waitForFunction(() => !location.pathname.includes("/complete"), { timeout: 12000 }).catch(() => {});
    await u.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
    await u.waitForTimeout(1200);
    out.sms = await verifySms(u);
    if (u.url().includes("/verify") && !out.sms) out.sms = await verifySms(u);
    await u.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
    await u.waitForTimeout(2500);
    out.url = u.url();
    out.body = (await u.locator("main").innerText().catch(() => "")).slice(0, 500);
    out.paywall = await u.getByTestId("paywall").count();
    out.mode = await u.getByTestId("paywall").getAttribute("data-mode").catch(() => null);
    await u.screenshot({ path: "/workspace/screenshots/money-user-paid.png", fullPage: true });
  } catch (err) {
    out.userErr = String(err).slice(0, 220);
    await u.screenshot({ path: "/workspace/screenshots/money-user-paid.png", fullPage: true }).catch(() => {});
  }
  await uc.close();
} finally {
  const { p: a2, ctx: c2 } = await open();
  await a2.goto(BASE, { waitUntil: "domcontentloaded" });
  await a2.waitForTimeout(2200);
  await api(a2, "/api/auth/sign-in/email", { email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" });
  await a2.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
  await a2.waitForSelector('[data-testid="money-mode-free"]', { timeout: 15000 });
  await a2.locator('[data-testid="money-mode-free"]').click();
  await save(a2);
  out.restored = await a2.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
  await a2.screenshot({ path: "/workspace/screenshots/money-tab-restored.png", fullPage: true });
  await c2.close();
  await browser.close();
  console.log(JSON.stringify(out, null, 2));
}
