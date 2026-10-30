import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const stamp = Date.now();

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

async function forceRo(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("jobpeloc-lang", "ro");
    } catch {
      /* ignore */
    }
  });
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
attach(page, "A");
await forceRo(page);

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(900);
await page.getByRole("button", { name: "RO", exact: true }).click();
await page.waitForTimeout(250);
const home = await page.locator("body").innerText();
const heroSearch = page.locator("input.field").first();
await heroSearch.waitFor({ state: "visible", timeout: 10000 });
console.log({
  homeTitle: home.includes("Joburi rapide") || home.includes("Quick jobs"),
  searchBar: await heroSearch.count(),
  langRO: await page.getByRole("button", { name: "RO", exact: true }).count(),
  savedNav: home.includes("Salvate") || home.includes("Saved"),
});
await page.screenshot({ path: "/workspace/screenshots/v7-home.png" });

await heroSearch.fill("mobilă");
await page.waitForTimeout(900);
const afterSearch = await page.locator("#joburi a[href^='/jobs/']").count();
const joburiText = (await page.locator("#joburi").innerText()).toLowerCase();
console.log({
  searchHits: afterSearch,
  hasMobila: joburiText.includes("mobil"),
});
await page.screenshot({ path: "/workspace/screenshots/v7-search.png" });

await page.getByRole("button", { name: "EN", exact: true }).click();
await page.waitForTimeout(400);
const enText = await page.locator("body").innerText();
console.log({
  enTitle: enText.includes("Quick jobs"),
  enSearch: enText.includes("Search"),
  enSaved: enText.includes("Saved"),
});
await page.screenshot({ path: "/workspace/screenshots/v7-en.png" });

await page.getByRole("button", { name: "RU", exact: true }).click();
await page.waitForTimeout(400);
const ruText = await page.locator("body").innerText();
console.log({
  ruTitle: ruText.includes("Быстрая работа"),
  ruSaved: ruText.includes("Сохранённые"),
});
await page.getByRole("button", { name: "RO", exact: true }).click();
await page.waitForTimeout(300);

await page.locator("#joburi a[href^='/jobs/']").first().click();
await page.waitForTimeout(800);
const jobText = await page.locator("body").innerText();
console.log({
  share: jobText.includes("Distribuie"),
  report: jobText.includes("Raportează"),
  apply: jobText.includes("Aplică") || jobText.includes("Ai aplicat"),
  heart: await page.locator("button[aria-label='Salvează'], button[aria-label='Salvat']").count(),
});
await page.screenshot({ path: "/workspace/screenshots/v7-job.png" });

await page.getByRole("button", { name: "Distribuie" }).click();
await page.waitForTimeout(350);
const afterShare = await page.locator("body").innerText();
console.log({
  whatsapp: afterShare.includes("WhatsApp"),
  copy: afterShare.includes("Copiază") || afterShare.includes("Link copiat"),
});

await page.getByRole("button", { name: "Raportează" }).click();
await page.waitForTimeout(250);
console.log({
  reportOpen: (await page.locator("body").innerText()).includes("Motiv"),
});

await page.goto(`${BASE}/cont?tab=saved`, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(600);
console.log({ contRedirect: page.url().includes("/login") });

const email = `v7.${stamp}@jobpeloc.test`;
await page.goto(`${BASE}/login?mode=up`, { waitUntil: "load", timeout: 45000 });
await page.getByPlaceholder("Prenume").waitFor({ state: "visible", timeout: 15000 });
await page.getByPlaceholder("Prenume").fill("Ana");
await page.getByPlaceholder("Nume", { exact: true }).fill("Tester");
await page.getByPlaceholder("Telefon").fill("069888777");
await page.getByPlaceholder("Email").fill(email);
await page.getByPlaceholder("Parolă (min. 8 caractere)").fill("parola123");
const createBtn = page.getByRole("button", { name: "Creează cont" });
await page.getByRole("checkbox").click();
await page.waitForTimeout(250);
if ((await page.getByRole("checkbox").getAttribute("aria-checked")) !== "true") {
  await page.getByRole("checkbox").click();
  await page.waitForTimeout(200);
}
console.log({ createDisabled: await createBtn.isDisabled(), checked: await page.getByRole("checkbox").getAttribute("aria-checked") });
await createBtn.click();
try {
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  console.log({ signupOk: true, url: page.url() });
} catch {
  await page.screenshot({ path: "/workspace/screenshots/v7-signup-fail.png" });
  console.log({ signupOk: false, url: page.url(), text: (await page.locator("body").innerText()).slice(0, 500) });
}

await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "RO", exact: true }).click();
await page.waitForTimeout(200);
const heart = page.locator("#joburi button[aria-label='Salvează']").first();
if (await heart.count()) {
  await heart.click();
  await page.waitForTimeout(700);
}
await page.goto(`${BASE}/cont?tab=saved`, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(900);
const savedText = await page.locator("body").innerText();
const savedLinks = await page.locator("main a[href^='/jobs/']").count();
console.log({
  savedUrl: page.url(),
  savedHeading: savedText.includes("Salvate") || savedText.includes("Joburi salvate"),
  savedLinks,
  accountPhoto: await page.locator("input[type=file]").count(),
  postedTab: savedText.includes("Joburi postate"),
  appliedTab: savedText.includes("aplicat"),
});
await page.screenshot({ path: "/workspace/screenshots/v7-saved.png" });

await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "RO", exact: true }).click();
await page.locator("#joburi a[href^='/jobs/']").first().click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Raportează" }).click();
await page.waitForTimeout(250);
await page.getByRole("button", { name: "Trimite raportul" }).click();
await page.waitForTimeout(1000);
console.log({ reported: (await page.locator("body").innerText()).includes("Raportul a fost trimis") });

const profileLink = page.locator('a[href^="/u/"]').first();
if (await profileLink.count()) {
  await profileLink.click();
  await page.waitForTimeout(700);
  const profileText = await page.locator("body").innerText();
  console.log({
    profile: profileText.includes("Profil public"),
    completed: profileText.includes("finalizat"),
    reportUser: profileText.includes("Raportează"),
  });
  await page.screenshot({ path: "/workspace/screenshots/v7-profile.png" });
}

await page.goto(`${BASE}/admin`, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(800);
const adminText = await page.locator("body").innerText();
console.log({
  admin: adminText.includes("Moderare"),
  hasReport: adminText.includes("Informații false") || adminText.includes("Anunț") || adminText.includes("Niciun raport"),
});
await page.screenshot({ path: "/workspace/screenshots/v7-admin.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
attach(mobile, "M");
await forceRo(mobile);
await mobile.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
await mobile.waitForTimeout(800);
const scrollW = await mobile.evaluate(() => document.documentElement.scrollWidth);
console.log({ mobileOverflow: scrollW > 410, scrollW });
await mobile.screenshot({ path: "/workspace/screenshots/v7-home-mobile.png" });

await browser.close();
console.log("DONE");
