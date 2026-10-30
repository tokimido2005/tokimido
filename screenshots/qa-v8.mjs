import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const uid = String(Date.now()).slice(-7);
const email = `qa${uid}@jobpeloc.test`;
const email2 = `qb${uid}@jobpeloc.test`;
const phone = `069${uid.slice(0, 6)}`;
const phone2 = `068${uid.slice(0, 6)}`;
const password = "Parola123";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

function attach(page, label) {
  page.on("pageerror", (e) => console.log(label, "PAGEERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(label, "CONSOLE", m.text().slice(0, 240));
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

async function dismissOnboarding(page) {
  const skip = page.getByRole("button", { name: "Sari", exact: true });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(300);
  }
}

async function solveCaptcha(page) {
  const box = page.locator("span").filter({ hasText: "= ?" }).first();
  await box.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = [...document.querySelectorAll("span")].find((s) => (s.textContent || "").includes("= ?"));
      return Boolean(el && /\d+\s*\+\s*\d+/.test(el.textContent || ""));
    },
    { timeout: 15000 },
  );
  const text = await box.innerText();
  const m = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) throw new Error(`captcha parse failed: ${text}`);
  await page.getByPlaceholder("Răspuns").fill(String(Number(m[1]) + Number(m[2])));
}

const results = {};

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page, "A");
await boot(page);

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(800);
results.homeTitle = await page.title();
results.homeHasJobs = (await page.locator("#joburi a[href^='/jobs/']").count()) > 0;
results.todayChip = await page.getByRole("button", { name: "Astăzi", exact: true }).count();
results.urgentChip = await page.getByRole("button", { name: "Urgent", exact: true }).count();
results.dataLayer = await page.evaluate(() => Array.isArray(window.dataLayer));
results.footerTerms = await page.getByRole("link", { name: "Termeni" }).count();
results.footerPrivacy = await page.getByRole("link", { name: "Confidențialitate" }).count();
results.footerFaq = await page.getByRole("link", { name: "Întrebări" }).count();
results.footerContact = await page.getByRole("link", { name: "Contact" }).count();
await page.screenshot({ path: "/workspace/screenshots/v8-home.png", fullPage: true });

await page.getByRole("button", { name: "Astăzi", exact: true }).click();
await page.waitForTimeout(600);
results.todayFilter = await page.locator("#joburi").innerText();
await page.getByRole("button", { name: "Urgent", exact: true }).click();
await page.waitForTimeout(600);
results.urgentActive = await page.getByRole("button", { name: "Urgent", exact: true }).evaluate((el) =>
  el.className.includes("bg-brand"),
);
await page.screenshot({ path: "/workspace/screenshots/v8-urgent.png" });

await page.getByRole("button", { name: "Reset", exact: false }).count();
const reset = page.getByRole("button", { name: /Resetează|Reset/ });
if (await reset.count()) await reset.first().click();
await page.waitForTimeout(300);
await page.locator("#joburi input.field").first().fill("zzzznojob999xyz");
await page.waitForTimeout(900);
results.emptyState = (await page.locator("#joburi").innerText()).includes("Niciun job");
await page.screenshot({ path: "/workspace/screenshots/v8-empty.png" });

for (const [path, expectTitle] of [
  ["/termeni", "Termeni"],
  ["/confidentialitate", "confidențialitate"],
  ["/faq", "Întrebări"],
  ["/contact", "Contact"],
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const title = await page.title();
  const body = await page.locator("main").innerText();
  results[`page${path}`] = { title, hasH1: body.length > 40, match: title.toLowerCase().includes(expectTitle.toLowerCase()) };
}
await page.screenshot({ path: "/workspace/screenshots/v8-faq.png" });

await page.goto(`${BASE}/login?mode=up`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(600);
results.loginCaptcha = (await page.getByPlaceholder("Răspuns").count()) > 0;
results.loginTermsLink = await page.getByRole("link", { name: "Termeni" }).count();
await page.screenshot({ path: "/workspace/screenshots/v8-signup.png" });

await page.getByPlaceholder("Prenume", { exact: true }).fill("Ana");
await page.getByPlaceholder("Nume", { exact: true }).fill("Tester");
await page.getByPlaceholder("Telefon", { exact: true }).fill(phone);
await page.getByPlaceholder("Email", { exact: true }).fill(email);
await page.getByPlaceholder(/Parolă/).fill(password);
await page.getByRole("checkbox").click();
await solveCaptcha(page);
await page.getByRole("button", { name: "Creează cont" }).click();
try {
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 20000 });
} catch {
  /* stay on login if signup failed */
}
await page.waitForTimeout(600);
results.afterSignupUrl = page.url();
results.onboarding = (await page.locator("body").innerText()).includes("Bun venit");
await page.screenshot({ path: "/workspace/screenshots/v8-onboard.png" });
if (results.onboarding) {
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Continuă" }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Am înțeles" }).click();
  await page.waitForTimeout(400);
  results.onboardingClosed = !(await page.locator("body").innerText()).includes("Găsește joburi lângă tine");
}
await dismissOnboarding(page);

await page.goto(`${BASE}/post`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(700);
await dismissOnboarding(page);
results.postCaptcha = (await page.getByPlaceholder("Răspuns").count()) > 0;
await page.locator("input.field").first().fill("Ajutor QA mutare test");
await page.locator("textarea.field").fill("Descriere pentru testul de publicare cu toate câmpurile obligatorii.");
await page.getByPlaceholder("06xxxxxxxx").fill(phone);
await solveCaptcha(page);
await page.getByRole("button", { name: "Publică anunțul" }).click();
await page.waitForTimeout(2000);
results.postedUrl = page.url();
results.postedOk = page.url().includes("/jobs/");
results.viewsOnJob = (await page.locator("body").innerText()).includes("vizualiz");
await page.screenshot({ path: "/workspace/screenshots/v8-posted.png" });

const jobPath = new URL(page.url()).pathname;
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
results.viewsAfterReload = (await page.locator("body").innerText()).includes("vizualiz");

await page.goto(`${BASE}/aplicatii`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(800);
await dismissOnboarding(page);
results.inboxHasJob = (await page.locator("body").innerText()).includes("Ajutor QA");
await page.getByRole("button", { name: "Șterge" }).first().click();
await page.waitForTimeout(300);
results.confirmDialog = (await page.locator('[role="dialog"]').innerText()).includes("Ștergi");
await page.screenshot({ path: "/workspace/screenshots/v8-confirm.png" });
await page.locator('[role="dialog"] button', { hasText: "Renunță" }).click();
await page.waitForTimeout(200);
results.confirmClosed = (await page.locator('[role="dialog"]').count()) === 0;

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(600);
const firstJob = page.locator("#joburi a[href^='/jobs/']").first();
if (await firstJob.count()) {
  await firstJob.click();
  await page.waitForTimeout(800);
  const poster = page.locator('a[href^="/u/"]').first();
  if (await poster.count()) {
    await poster.click();
    await page.waitForTimeout(700);
    results.profileBlock = await page.getByRole("button", { name: "Blochează" }).count();
    if (results.profileBlock) {
      await page.getByRole("button", { name: "Blochează" }).click();
      await page.waitForTimeout(800);
      results.blockedToast = (await page.locator("body").innerText()).includes("blocat");
    }
    await page.screenshot({ path: "/workspace/screenshots/v8-block.png" });
  }
}

await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(600);
results.adminTitle = await page.title();

await page.getByRole("button", { name: /Întunecat|Dark/i }).first().click().catch(() => {});
const darkBtn = page.locator('button[aria-label*="întunecat"], button[title*="întunecat"], button[aria-label*="Dark"]').first();
if (await darkBtn.count()) await darkBtn.click();
else await page.locator('button[title="Mod întunecat"], button[aria-label="Mod întunecat"]').first().click().catch(() => {});
await page.waitForTimeout(300);
results.darkClass = await page.evaluate(() => document.documentElement.classList.contains("dark"));
await page.screenshot({ path: "/workspace/screenshots/v8-dark.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
attach(mobile, "M");
await boot(mobile, { onboarded: true, theme: "light" });
await mobile.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
await mobile.waitForTimeout(800);
results.mobileOverflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
);
await mobile.screenshot({ path: "/workspace/screenshots/v8-mobile.png" });
await mobile.close();

try {
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  attach(page2, "B");
  await boot(page2, { onboarded: true });
  await page2.goto(`${BASE}/login?mode=up`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page2.waitForTimeout(900);
  await page2.getByPlaceholder("Prenume", { exact: true }).fill("Ion");
  await page2.getByPlaceholder("Nume", { exact: true }).fill("Dublu");
  await page2.getByPlaceholder("Telefon", { exact: true }).fill(phone);
  await page2.getByPlaceholder("Email", { exact: true }).fill(email2);
  await page2.getByPlaceholder(/Parolă/).fill(password);
  await page2.getByRole("checkbox").click();
  await solveCaptcha(page2);
  await page2.getByRole("button", { name: "Creează cont" }).click();
  await page2.waitForTimeout(1800);
  results.uniquePhone = (await page2.locator("body").innerText()).toLowerCase().includes("deja");
  await page2.screenshot({ path: "/workspace/screenshots/v8-unique-phone.png" });
  await page2.close();
} catch (err) {
  results.uniquePhoneError = err instanceof Error ? err.message : String(err);
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
