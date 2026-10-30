import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function boot(context, lang = "ro") {
  await context.addInitScript((l) => {
    sessionStorage.setItem("rabotaem-splash-v3", "1");
    localStorage.setItem("rabotaem-lang", l);
    localStorage.setItem("rabotaem-onboarded", "1");
    localStorage.setItem("rabotaem-theme", "light");
  }, lang);
}

async function signAdmin(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1600);
  return page.evaluate(async () => {
    const r = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: "tokimido@rabotaem.md", password: "Nascutinanul2005-" }),
    });
    return r.status;
  });
}

async function setMode(page, id) {
  await page.goto(`${BASE}/admin?tab=money`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-testid="money-mode-${id}"]`, { timeout: 20000 });
  const live = await page.getByTestId(`money-mode-${id}`).getAttribute("data-live");
  if (live === "true") return { skipped: true };
  await page.getByTestId(`money-mode-${id}`).click();
  await page.waitForTimeout(200);
  const save = page.getByTestId("money-save");
  if (await save.isDisabled()) return { skipped: true };
  await save.click();
  const dialog = page.locator('[role="dialog"]');
  if (await dialog.count()) {
    await dialog.getByRole("button").last().click();
  }
  await page.waitForFunction(
    (mode) => document.querySelector("[data-testid=money-active-mode]")?.getAttribute("data-mode") === mode,
    id,
    { timeout: 20000 },
  ).catch(() => {});
  return { skipped: false };
}

function scan(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    return {
      url: location.pathname,
      htmlMoney: document.documentElement.dataset.money || "",
      navPro: !!document.querySelector('[data-testid="nav-pro"]'),
      footerPro: !!document.querySelector('[data-testid="footer-pro"]'),
      proLinks: [...document.querySelectorAll('a[href="/pro"]')].map((a) => (a.textContent || "").trim()),
      paywall: !!document.querySelector('[data-testid="paywall"]'),
      hasActivate: /Activează Pro|Activate Pro|Активировать Pro|Rabotaem Pro/i.test(text),
      hasAbonament: /abonament|подписк|subscription/i.test(text),
    };
  });
}

const out = {};
const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await boot(adminCtx);
const admin = await adminCtx.newPage();
out.sign = await signAdmin(admin);

out.toPaid = await setMode(admin, "paid");
const paidCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await boot(paidCtx);
const paid = await paidCtx.newPage();
await paid.goto(BASE, { waitUntil: "domcontentloaded" });
await paid.waitForTimeout(1800);
out.paidHome = await scan(paid);
await paid.screenshot({ path: "/workspace/screenshots/money-home-paid.png" });
await paid.goto(`${BASE}/pro`, { waitUntil: "domcontentloaded" });
await paid.waitForTimeout(800);
out.paidProUrl = paid.url();
await paidCtx.close();

out.toFree = await setMode(admin, "free");
const freeCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await boot(freeCtx);
const free = await freeCtx.newPage();
await free.goto(BASE, { waitUntil: "domcontentloaded" });
await free.waitForTimeout(1800);
out.freeHome = await scan(free);
await free.screenshot({ path: "/workspace/screenshots/money-home-free.png" });
await free.goto(`${BASE}/pro`, { waitUntil: "domcontentloaded" });
await free.waitForTimeout(1200);
out.freeProUrl = free.url();
out.freeProScan = await scan(free);
await free.goto(`${BASE}/faq`, { waitUntil: "domcontentloaded" });
await free.waitForTimeout(700);
out.freeFaq = await scan(free);
await free.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await free.waitForTimeout(700);
out.freeLogin = await scan(free);
const jobHref = await (async () => {
  await free.goto(BASE, { waitUntil: "domcontentloaded" });
  await free.waitForTimeout(800);
  return free.locator("a[href^='/jobs/']").first().getAttribute("href");
})();
if (jobHref) {
  await free.goto(BASE + jobHref, { waitUntil: "domcontentloaded" });
  await free.waitForTimeout(1000);
  out.freeJob = await scan(free);
}
await free.screenshot({ path: "/workspace/screenshots/money-free-login.png" });
await freeCtx.close();

out.restore = await setMode(admin, "free");
await adminCtx.close();
await browser.close();
console.log(JSON.stringify(out, null, 2));
