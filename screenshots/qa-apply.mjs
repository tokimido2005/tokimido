import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const uid = Date.now().toString().slice(-6);
const email = `apply${uid}@jobpeloc.test`;
const password = "Parola123";
const phone = `06977${uid.slice(-4)}`;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function boot(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("rabotaem-splash-v3", "1");
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-lang", "ro");
    localStorage.setItem("rabotaem-onboarded", "1");
    localStorage.setItem("rabotaem-theme", "light");
  });
}

async function api(page, path, body) {
  return page.evaluate(async ({ path, body }) => {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    return r.status;
  }, { path, body });
}

const out = {};
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await boot(page);
page.on("pageerror", (e) => console.log("ERR", e.message.slice(0, 220)));

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(1800);
const jobHref = await page.locator("a[href^='/jobs/']").first().getAttribute("href");
out.jobHref = jobHref;

await page.goto(BASE + jobHref, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="apply-btn"]', { timeout: 15000 });
out.guestBtn = await page.getByTestId("apply-btn").innerText();
out.sticky = (await page.getByTestId("apply-btn-sticky").count()) > 0;
out.topBtn = (await page.getByTestId("apply-btn-top").count()) > 0;
await page.screenshot({ path: "/workspace/screenshots/apply-guest.png", fullPage: true });
await page.getByTestId("apply-btn-sticky").click();
await page.waitForTimeout(1200);
out.afterGuestClick = page.url();

out.signup = await api(page, "/api/auth/sign-up/email", { name: "Ana Apply", email, password });
out.signin = await api(page, "/api/auth/sign-in/email", { email, password });

await page.goto(BASE + jobHref, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="apply-btn"]', { timeout: 15000 });
await page.getByTestId("apply-btn").click();
await page.waitForTimeout(1800);
out.afterUnverifiedClick = page.url();
await page.screenshot({ path: "/workspace/screenshots/apply-unverified.png", fullPage: true });

if (!page.url().includes("/complete") && !page.url().includes("/verify")) {
  await page.goto(`${BASE}/complete?next=${encodeURIComponent(jobHref)}`, { waitUntil: "domcontentloaded" });
}

if (page.url().includes("/complete") || (await page.getByTestId("complete-phone").count())) {
  await page.getByTestId("complete-phone").waitFor({ timeout: 12000 });
  await page.getByTestId("complete-phone").fill(phone);
  await page.evaluate(() => document.querySelector('button[role="checkbox"]')?.click());
  await page.waitForTimeout(200);
  await page.getByTestId("complete-submit").click({ force: true });
  await page.waitForFunction(() => !location.pathname.includes("/complete"), { timeout: 15000 }).catch(() => {});
}
out.afterComplete = page.url();

if (page.url().includes("/verify") || (await page.getByTestId("sms-preview").count())) {
  await page.getByTestId("sms-preview").waitFor({ timeout: 12000 }).catch(() => {});
  const preview = await page.getByTestId("sms-preview").innerText().catch(() => "");
  out.preview = preview;
  const code = (preview.match(/(\d{6})/) || [])[1];
  if (code) {
    await page.getByTestId("sms-code").fill(code);
    await page.getByRole("button", { name: /Verifică/i }).click();
    await page.waitForTimeout(1800);
  }
}
out.afterVerify = page.url();

await page.goto(BASE + jobHref, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-testid="apply-btn"]', { timeout: 15000 });
out.verifiedHasForm = (await page.locator("#aplica textarea").count()) > 0;
out.requiredMin = await page.locator("#aplica textarea").getAttribute("required");
await page.screenshot({ path: "/workspace/screenshots/apply-ready.png", fullPage: true });
await page.getByTestId("apply-btn").click();
await page.waitForFunction(() => location.pathname.includes("/aplicat"), { timeout: 20000 }).catch(() => {});
out.afterApply = page.url();
out.success = await page.getByTestId("apply-success").innerText().catch(() => "");
await page.screenshot({ path: "/workspace/screenshots/apply-success.png", fullPage: true });

await page.goto(BASE + jobHref, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
out.already = await page.getByTestId("apply-done").innerText().catch(() => "");
await page.screenshot({ path: "/workspace/screenshots/apply-already.png", fullPage: true });

const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const d = await desk.newPage();
await boot(d);
await d.goto(BASE, { waitUntil: "domcontentloaded" });
await d.waitForTimeout(1600);
await api(d, "/api/auth/sign-in/email", { email, password });
const other = await d.locator("a[href^='/jobs/']").nth(1).getAttribute("href");
await d.goto(BASE + other, { waitUntil: "domcontentloaded" });
await d.waitForSelector('[data-testid="apply-btn"]', { timeout: 15000 });
out.deskBtnVisible = await d.getByTestId("apply-btn").isVisible();
out.deskSticky = await d.getByTestId("apply-btn-sticky").isVisible();
const box = await d.getByTestId("apply-btn-sticky").boundingBox();
out.deskStickyY = box ? Math.round(box.y) : null;
await d.screenshot({ path: "/workspace/screenshots/apply-desktop.png", fullPage: true });
await desk.close();

await ctx.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
