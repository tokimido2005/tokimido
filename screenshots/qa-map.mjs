import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const uid = String(Date.now()).slice(-6);
const posterEmail = `map.p${uid}@jobpeloc.test`;
const workerEmail = `map.w${uid}@jobpeloc.test`;
const posterPhone = `068${uid.padStart(6, "0").slice(0, 6)}`;
const workerPhone = `069${uid.padStart(6, "0").slice(0, 6)}`;
const password = "Parola123";

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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
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
    if (m.type() === "error") console.log(label, "CONSOLE", m.text().slice(0, 200));
  });
  return { page, context };
}

async function api(page, path, body) {
  const res = await page.request.post(`${BASE}${path}`, {
    data: body,
    headers: { "Content-Type": "application/json" },
  });
  return { status: res.status(), text: (await res.text()).slice(0, 400) };
}

async function completeAndVerify(page, phone, label) {
  await page.goto(`${BASE}/complete`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("complete-form").waitFor({ timeout: 15000 });
  const phoneInput = page.getByTestId("complete-phone");
  if ((await phoneInput.count()) > 0) {
    await phoneInput.fill(phone);
  }
  const first = page.locator('input[autocomplete="given-name"]');
  const last = page.locator('input[autocomplete="family-name"]');
  if ((await first.count()) && (await first.inputValue()) === "") await first.fill("Ana");
  if ((await last.count()) && (await last.inputValue()) === "") await last.fill("Test");
  await page.evaluate(() => document.querySelector('button[role=checkbox]')?.click());
  await page.waitForTimeout(200);
  await page.getByTestId("complete-submit").click({ force: true });
  await page.waitForFunction(() => !location.pathname.includes("/complete"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  if (!page.url().includes("/verify")) {
    await page.goto(`${BASE}/verify`, { waitUntil: "domcontentloaded" });
  }
  await page.getByTestId("verify-screen").waitFor({ timeout: 15000 });
  const preview = await page.getByTestId("sms-preview").innerText();
  const code = preview.match(/(\d{6})/)?.[1];
  if (!code) throw new Error(`${label} no sms code: ${preview}`);
  await page.getByTestId("sms-code").fill(code);
  await page.getByRole("button", { name: /Verifică|Проверить|Verify/i }).click();
  await page.waitForFunction(() => !location.pathname.includes("/verify"), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  return code;
}

async function solveCaptcha(page) {
  const text = await page.locator("span.bg-brand").filter({ hasText: "+" }).innerText();
  const m = text.match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) throw new Error(`captcha: ${text}`);
  const sum = Number(m[1]) + Number(m[2]);
  await page.locator('input[aria-label]').last().fill(String(sum));
  return sum;
}

try {
const { page: poster, context: posterCtx } = await newPage("POSTER");
await poster.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
await poster.waitForTimeout(800);
results.posterSignup = await api(poster, "/api/auth/sign-up/email", {
  name: "Poster Map",
  email: posterEmail,
  password,
});
results.posterSignin = await api(poster, "/api/auth/sign-in/email", { email: posterEmail, password });
await completeAndVerify(poster, posterPhone, "poster");

await poster.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await poster.getByRole("heading", { name: /Postez un job/i }).waitFor({ timeout: 15000 });
results.postHasPicker = (await poster.getByTestId("map-picker").count()) > 0;
await poster.locator("input.field").first().fill("Curățenie cu pin pe hartă");
await poster.locator("textarea.field").fill("Trebuie curățat un apartament de 2 camere, materiale pe loc, pin pe hartă.");
const map = poster.getByTestId("map-canvas");
await map.waitFor({ timeout: 8000 });
await poster.waitForTimeout(400);
const box = await map.boundingBox();
if (box) {
  await map.click({ position: { x: Math.round(box.width / 2), y: Math.round(box.height / 2) } });
}
await poster.getByTestId("map-set").waitFor({ timeout: 5000 }).catch(() => {});
results.pinSet = (await poster.getByTestId("map-set").count()) > 0;
results.pinText = await poster.getByTestId("map-set").innerText().catch(() => "");
await poster.screenshot({ path: "/workspace/artifacts/qa-map-post.png", fullPage: true });
await solveCaptcha(poster);
await poster.getByTestId("post-publish").click();
await poster.waitForFunction(() => location.pathname.includes("/jobs/"), { timeout: 20000 }).catch(() => {});
await poster.waitForTimeout(1200);
results.postedUrl = poster.url();
results.postError = await poster.locator("p.text-danger").innerText().catch(() => "");
const jobId = Number(poster.url().match(/\/jobs\/(\d+)/)?.[1] || 0);
results.jobId = jobId;
results.ownerExact = (await poster.getByTestId("map-exact").count()) > 0;
results.ownerPrivacy = (await poster.getByTestId("map-privacy").count()) > 0;
results.ownerOpenHref = await poster.getByTestId("map-open-maps").getAttribute("href").catch(() => "");
await poster.screenshot({ path: "/workspace/artifacts/qa-map-owner.png", fullPage: true });
await poster.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });

const { page: guest, context: guestCtx } = await newPage("GUEST");
const jobPayloads = [];
guest.on("response", async (res) => {
  try {
    const ct = res.headers()["content-type"] || "";
    if (!ct.includes("json") && !ct.includes("text")) return;
    const text = await res.text();
    if (text.includes("geo_lat") || text.includes("has_geo") || text.includes('"visible"')) {
      jobPayloads.push(text.slice(0, 500));
    }
  } catch {
    /* ignore */
  }
});
await guest.goto(results.postedUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
await guest.getByTestId("map-privacy-msg").waitFor({ timeout: 12000 });
await guest.waitForTimeout(400);
results.guestPrivacy = (await guest.getByTestId("map-privacy").count()) > 0;
results.guestExact = (await guest.getByTestId("map-exact").count()) > 0;
results.guestOpen = (await guest.getByTestId("map-open-maps").count()) > 0;
results.guestMsg = await guest.getByTestId("map-privacy-msg").innerText().catch(() => "");
results.guestHasCoordsInDom = /47\.\d{3,}|28\.\d{3,}/.test(await guest.locator("main").innerText());
results.guestLeakedGeoLat = jobPayloads.some((t) => /"geo_lat"\s*:/.test(t));
results.guestPayloads = jobPayloads.slice(0, 4);
await guest.screenshot({ path: "/workspace/artifacts/qa-map-guest.png", fullPage: true });
await guestCtx.close();

const { page: worker, context: workerCtx } = await newPage("WORKER");
await worker.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
await worker.waitForTimeout(800);
results.workerSignup = await api(worker, "/api/auth/sign-up/email", {
  name: "Worker Map",
  email: workerEmail,
  password,
});
results.workerSignin = await api(worker, "/api/auth/sign-in/email", { email: workerEmail, password });
await completeAndVerify(worker, workerPhone, "worker");
await worker.goto(results.postedUrl, { waitUntil: "domcontentloaded" });
await worker.getByRole("heading", { name: /Curățenie cu pin/i }).waitFor({ timeout: 20000 });
await worker.waitForTimeout(800);
results.pendingPrivacy = (await worker.getByTestId("map-privacy").count()) > 0;
results.pendingExact = (await worker.getByTestId("map-exact").count()) > 0;
results.workerUrl = worker.url();
await worker.screenshot({ path: "/workspace/artifacts/qa-map-worker.png", fullPage: true });
await worker.locator("#aplica textarea.field, #aplica a").first().waitFor({ timeout: 25000 });
const applyBox = worker.locator("#aplica textarea.field");
if ((await applyBox.count()) === 0) {
  results.workerCta = (await worker.locator("#aplica").innerText().catch(() => "")).slice(0, 400);
  const cta = worker.locator("#aplica a").first();
  if (await cta.count()) await cta.click();
  await worker.waitForTimeout(1500);
  results.workerAfterCta = worker.url();
} else {
  await applyBox.fill("Pot ajunge dimineața, am experiență la curățenie.");
  await worker.getByRole("button", { name: /^Aplică$/ }).click();
  await worker.waitForFunction(() => location.pathname.includes("/aplicat"), { timeout: 15000 }).catch(() => {});
}
await worker.waitForTimeout(800);
results.afterApplyUrl = worker.url();
results.applyPrivacy = (await worker.getByTestId("map-privacy-msg").count()) > 0;
await worker.screenshot({ path: "/workspace/artifacts/qa-map-pending.png", fullPage: true });

await poster.goto(`${BASE}/aplicatii`, { waitUntil: "domcontentloaded" });
await poster.waitForTimeout(1400);
results.inboxHint = await poster.locator("text=Locația exactă pe hartă").count();
await poster.getByRole("button", { name: /^Selectat$/ }).first().click();
await poster.waitForTimeout(1200);
await poster.screenshot({ path: "/workspace/artifacts/qa-map-select.png", fullPage: true });

await worker.goto(results.postedUrl, { waitUntil: "domcontentloaded" });
await worker.getByTestId("map-exact").waitFor({ timeout: 15000 });
results.selectedExact = (await worker.getByTestId("map-exact").count()) > 0;
results.selectedPrivacy = (await worker.getByTestId("map-privacy").count()) > 0;
results.selectedOpen = await worker.getByTestId("map-open-maps").getAttribute("href").catch(() => "");
results.selectedHasPin = (await worker.getByTestId("map-pin").count()) > 0;
await worker.screenshot({ path: "/workspace/artifacts/qa-map-selected.png", fullPage: true });

await worker.goto(`${BASE}/cont?tab=apps`, { waitUntil: "domcontentloaded" });
await worker.getByTestId("map-see-exact").waitFor({ timeout: 12000 }).catch(() => {});
results.accountSeeExact = (await worker.getByTestId("map-see-exact").count()) > 0;
await worker.screenshot({ path: "/workspace/artifacts/qa-map-account.png", fullPage: true });

await posterCtx.close();
await workerCtx.close();
await browser.close();
console.log(JSON.stringify(results, null, 2));
} catch (err) {
  results.error = String(err?.message || err).slice(0, 400);
  console.log(JSON.stringify(results, null, 2));
  await browser.close().catch(() => {});
  throw err;
}