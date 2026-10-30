import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const boot = {
  sessionStorage: { "rabotaem-splash-v3": "1", "rabotaem-splash": "1" },
  localStorage: { "rabotaem-lang": "en", "rabotaem-onboarded": "1", "rabotaem-theme": "light" },
};
async function page(w=1280,h=900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript((d) => {
    for (const [k,v] of Object.entries(d.sessionStorage)) sessionStorage.setItem(k,v);
    for (const [k,v] of Object.entries(d.localStorage)) localStorage.setItem(k,v);
  }, boot);
  const p = await ctx.newPage();
  return { p, ctx };
}
async function api(p, path, body) {
  return p.evaluate(async ({path, body}) => {
    const r = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include", body: JSON.stringify(body) });
    return { status: r.status, text: (await r.text()).slice(0,200) };
  }, { path, body });
}
async function save(p) {
  await p.locator('[data-testid="money-save"]').click();
  const d = p.locator('[role="dialog"]');
  try { await d.waitFor({ timeout: 1600 }); await d.getByRole("button", { name: /Save and apply|Salvează|Сохранить/i }).click(); } catch {}
  await p.waitForTimeout(1200);
}
const out = {};
const { p, ctx } = await page();
await p.goto(BASE, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2200);
out.sign = await api(p, "/api/auth/sign-in/email", { email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" });
await p.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
await p.waitForSelector('[data-testid="money-mode-paid"]', { timeout: 20000 });
await p.locator('[data-testid="money-mode-paid"]').click();
await save(p);
out.paid = await p.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
await ctx.close();

const uid = String(Date.now()).slice(-6);
const { p: u, ctx: uc } = await page();
await u.goto(BASE, { waitUntil: "domcontentloaded" });
await u.waitForTimeout(2200);
out.signup = await api(u, "/api/auth/sign-up/email", { name: "Ana Pay", email: `pay${uid}@jobpeloc.test`, password: "Parola123" });
await api(u, "/api/auth/sign-in/email", { email: `pay${uid}@jobpeloc.test`, password: "Parola123" });
await u.goto(`${BASE}/complete`, { waitUntil: "domcontentloaded" });
try {
  await u.getByTestId("complete-phone").waitFor({ timeout: 10000 });
  await u.getByTestId("complete-phone").fill(`069${uid}`);
  await u.evaluate(() => document.querySelector('button[role="checkbox"]')?.click());
  await u.waitForTimeout(200);
  await u.getByTestId("complete-submit").click({ force: true });
  await u.waitForFunction(() => !location.pathname.includes("/complete"), { timeout: 10000 }).catch(()=>{});
} catch (e) { out.completeErr = String(e).slice(0,120); }
await u.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await u.waitForTimeout(1800);
if (await u.getByTestId("sms-preview").count()) {
  const t = await u.getByTestId("sms-preview").innerText();
  const m = t.match(/(\d{6})/);
  if (m) {
    await u.getByTestId("sms-code").fill(m[1]);
    await u.getByRole("button", { name: /Verifică|Verify|Проверить/i }).click();
    await u.waitForTimeout(1600);
  }
}
await u.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await u.waitForSelector('[data-testid="paywall"], form, [data-testid="sms-preview"]', { timeout: 15000 }).catch(()=>{});
out.url = u.url();
out.paywall = await u.getByTestId("paywall").count();
out.paywallMode = await u.getByTestId("paywall").getAttribute("data-mode").catch(()=>null);
await u.screenshot({ path: "/workspace/screenshots/money-user-paid.png", fullPage: true });
await uc.close();

const { p: a2, ctx: c2 } = await page();
await a2.goto(BASE, { waitUntil: "domcontentloaded" });
await a2.waitForTimeout(2200);
await api(a2, "/api/auth/sign-in/email", { email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" });
await a2.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
await a2.waitForSelector('[data-testid="money-mode-free"]', { timeout: 15000 });
await a2.locator('[data-testid="money-mode-free"]').click();
await save(a2);
out.restored = await a2.locator('[data-testid="money-active-mode"]').getAttribute("data-mode");
const { p: m, ctx: mc } = await page(390, 844);
await m.goto(BASE, { waitUntil: "domcontentloaded" });
await m.waitForTimeout(2200);
await api(m, "/api/auth/sign-in/email", { email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" });
await m.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
await m.waitForSelector('[data-testid="money-active-mode"]', { timeout: 15000 });
out.mobileOverflow = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
await m.screenshot({ path: "/workspace/screenshots/money-mobile.png", fullPage: true });
await mc.close();
await c2.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
