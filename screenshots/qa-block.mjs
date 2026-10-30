import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const uid = String(Date.now()).slice(-6);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("request", (r) => {
  const u = r.url();
  if (u.includes("api/auth") || u.includes("_serverFn") || u.includes("sign-up") || u.includes("sign-in")) {
    console.log("REQ", r.method(), u.replace("http://127.0.0.1:8080", "").slice(0, 140));
  }
});
await page.addInitScript(() => {
  sessionStorage.setItem("jobpeloc-splash", "1");
  localStorage.setItem("jobpeloc-lang", "ro");
  localStorage.setItem("jobpeloc-onboarded", "1");
});

await page.goto(`${BASE}/login?mode=up`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(600);
await page.getByPlaceholder("Prenume", { exact: true }).fill("Bloc");
await page.getByPlaceholder("Nume", { exact: true }).fill("Test");
await page.getByPlaceholder("Telefon", { exact: true }).fill(`065${uid}0`);
await page.getByPlaceholder("Email", { exact: true }).fill(`bl${uid}@jobpeloc.test`);
await page.getByPlaceholder(/Parolă/).fill("Parola123");
const box = page.locator('button[role="checkbox"]');
await box.click();
if ((await box.getAttribute("aria-checked")) !== "true") await box.click({ force: true });
await page.waitForFunction(
  () => {
    const el = [...document.querySelectorAll("span")].find((s) => (s.textContent || "").includes("= ?"));
    return Boolean(el && /\d+\s*\+\s*\d+/.test(el.textContent || ""));
  },
  { timeout: 15000 },
);
await page.waitForTimeout(1000);
const q = await page.locator("span").filter({ hasText: "= ?" }).first().innerText();
const m = q.match(/(\d+)\s*\+\s*(\d+)/);
if (!m) throw new Error(`bad captcha ${q}`);
await page.getByPlaceholder("Răspuns").fill(String(Number(m[1]) + Number(m[2])));
await page.waitForTimeout(200);
const btn = page.getByRole("button", { name: "Creează cont" });
console.log({
  answer: await page.getByPlaceholder("Răspuns").inputValue(),
  disabled: await btn.isDisabled(),
  checked: await box.getAttribute("aria-checked"),
  question: q,
});
page.on("request", (r) => {
  const u = r.url();
  if (u.includes("api/auth") || u.includes("_server") || u.includes("captcha") || u.includes("sign")) {
    console.log("REQ", r.method(), u.replace(BASE, "").slice(0, 120));
  }
});
if (await btn.isDisabled()) await box.click({ force: true });
await page.locator("form button[type='submit']").click({ timeout: 15000 });
await page.waitForTimeout(4000);
console.log("AFTER CLICK", page.url());
try {
  await page.waitForFunction(() => !location.pathname.includes("/login"), { timeout: 20000 });
} catch {
  console.log("STUCK", page.url());
  console.log((await page.locator("body").innerText()).slice(-800));
  await page.screenshot({ path: "/workspace/screenshots/v8-block-signup-fail.png" });
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(500);

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const before = await page.locator("#joburi a[href^='/jobs/']").count();

await page.goto(`${BASE}/u/seed-jobpeloc`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Blochează" }).click();
await page.waitForTimeout(1000);

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const after = await page.locator("#joburi a[href^='/jobs/']").count();
const empty = (await page.locator("#joburi").innerText()).includes("Niciun job");
console.log({ before, after, empty, drop: before - after });
await page.screenshot({ path: "/workspace/screenshots/v8-blocked-home.png", fullPage: true });
await browser.close();
