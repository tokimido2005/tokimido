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
  page.on("dialog", (d) => d.accept());
}

async function signup(page, { first, last, email, phone }) {
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/login?mode=up`, { waitUntil: "load", timeout: 45000 });
  await page.getByPlaceholder("Prenume").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(800);
  await page.getByPlaceholder("Prenume").fill(first);
  await page.getByPlaceholder("Nume", { exact: true }).fill(last);
  await page.getByPlaceholder("Telefon").fill(phone);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Parolă (min. 8 caractere)").fill("parola123");
  const createBtn = page.getByRole("button", { name: "Creează cont" });
  console.log("create disabled before checkbox", await createBtn.isDisabled());
  await page.getByRole("checkbox").click();
  await page.waitForTimeout(200);
  if ((await page.getByRole("checkbox").getAttribute("aria-checked")) !== "true") {
    await page.getByRole("checkbox").click();
    await page.waitForTimeout(200);
  }
  console.log("create disabled after checkbox", await createBtn.isDisabled());
  await createBtn.click();
  try {
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
  } catch (err) {
    console.log("signup stayed on", page.url());
    console.log("signup page text", (await page.locator("body").innerText()).slice(0, 500));
    await page.screenshot({ path: "/workspace/screenshots/v6-signup-stuck.png" });
    throw err;
  }
}

async function signin(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 45000 });
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Parolă (min. 8 caractere)").fill("parola123");
  await page.getByRole("button", { name: "Intră", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 });
}

const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
attach(page, "A");

await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(900);
const homeText = await page.locator("body").innerText();
const expiredVisible = homeText.includes("Ajutor la depozit — tură de ieri");
const cards = page.locator("#joburi a[href^='/jobs/']");
const cardCount = await cards.count();
const firstCard = await cards.first().innerText();
const hasDate = /\d{2}\.\d{2}\.\d{4}/.test(firstCard);
const hasTime = /\d{2}:\d{2}/.test(firstCard);
const firstHref = await cards.first().getAttribute("href");
console.log({
  homeOk: homeText.includes("Joburi rapide"),
  cardCount,
  expiredVisible,
  hasDate,
  hasTime,
  firstHref,
  firstCardSnippet: firstCard.replace(/\s+/g, " ").slice(0, 180),
});
await page.screenshot({ path: "/workspace/screenshots/v6-home.png" });

await page.goto(`${BASE}${firstHref}`, { waitUntil: "load" });
await page.waitForTimeout(600);
const detail = await page.locator("body").innerText();
console.log({
  detailTitle: await page.locator("h1").innerText(),
  detailHasDate: /\d{2}\.\d{2}\.\d{4}/.test(detail),
  detailHasTime: detail.includes("Ora") || /\d{2}:\d{2}/.test(detail),
  status: (detail.match(/Activ|Aproape complet|Finalizat|Expirat|Anulat/) || [null])[0],
});
await page.screenshot({ path: "/workspace/screenshots/v6-job.png" });

const jobTitle = `Curățenie birou QA ${stamp}`;
const deleteTitle = `Job de șters QA ${stamp}`;
const poster = {
  first: "Ana",
  last: "Poster",
  email: `poster${stamp}@jobpeloc.test`,
  phone: "069111111",
};
const worker = {
  first: "Ion",
  last: "Muncitor",
  email: `worker${stamp}@jobpeloc.test`,
  phone: "069222222",
};

await signup(page, poster);
console.log("poster signed up", page.url());

await page.goto(`${BASE}/post`, { waitUntil: "load" });
await page.waitForTimeout(400);
await page.locator('input[placeholder="Ex: Mutare canapea la etajul 3"]').fill(jobTitle);
await page.locator("textarea").fill("Trebuie spălat biroul, geamurile și pardoseala. Materialele sunt pe loc, lucrare de dimineață.");
await page.getByPlaceholder("06xxxxxxxx").fill("069333333");
await page.getByRole("button", { name: "Publică anunțul" }).click();
await page.waitForURL(/\/jobs\/\d+/, { timeout: 20000 });
const jobUrl = page.url();
const jobId = jobUrl.match(/\/jobs\/(\d+)/)?.[1];
console.log("posted", jobUrl);
await page.screenshot({ path: "/workspace/screenshots/v6-posted.png" });

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(700);
const listed = (await page.locator("body").innerText()).includes(jobTitle);
console.log({ postedListed: listed });

const workerCtx = await browser.newContext();
const workerPage = await workerCtx.newPage({ viewport: { width: 1280, height: 860 } });
attach(workerPage, "B");
await signup(workerPage, worker);
await workerPage.goto(jobUrl, { waitUntil: "load" });
await workerPage.waitForTimeout(500);
await workerPage.getByPlaceholder("Prenume").fill("Ion");
await workerPage.getByPlaceholder("Nume", { exact: true }).fill("Muncitor");
await workerPage.getByPlaceholder("Telefon").fill("069222222");
await workerPage.locator("textarea").fill("Pot ajunge dimineața, am făcut curățenie de birou înainte.");
await workerPage.getByRole("button", { name: "Aplică" }).click();
await workerPage.waitForURL(/aplicat/, { timeout: 20000 });
console.log("worker applied", workerPage.url());
await workerPage.screenshot({ path: "/workspace/screenshots/v6-applied.png" });

await page.goto(`${BASE}/aplicatii`, { waitUntil: "load" });
await page.waitForTimeout(800);
const inboxText = await page.locator("body").innerText();
console.log({
  inboxHasJob: inboxText.includes(jobTitle),
  inboxHasWorker: inboxText.includes("Ion"),
});
await page.getByRole("button", { name: "Selectat", exact: true }).first().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Finalizat" }).first().click();
await page.waitForTimeout(900);
const afterComplete = await page.locator("body").innerText();
console.log({
  completedBadge: afterComplete.includes("Finalizat"),
  ratePrompt: afterComplete.includes("Cum a lucrat") || afterComplete.includes("stele"),
  reactivate: afterComplete.includes("Reactivează"),
});
await page.screenshot({ path: "/workspace/screenshots/v6-completed.png" });

const starBtns = page.locator('[aria-label$="stele"], [aria-label$="stea"]');
if ((await starBtns.count()) >= 5) {
  await starBtns.nth(4).click();
  await page.locator('textarea[placeholder*="Comentariu"]').fill("Lucru bun, a venit la timp.");
  await page.getByRole("button", { name: "Trimite evaluarea" }).click();
  await page.waitForTimeout(800);
  console.log("poster rated worker");
}

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(700);
const hiddenAfterComplete = !(await page.locator("body").innerText()).includes(jobTitle);
console.log({ hiddenAfterComplete });

await workerPage.goto(`${BASE}/cont?tab=ratings`, { waitUntil: "load" });
await workerPage.waitForTimeout(900);
const workerRatings = await workerPage.locator("body").innerText();
console.log({
  workerPending: workerRatings.includes("Cum a fost") || workerRatings.includes("Ana"),
});
const wStars = workerPage.locator('[aria-label$="stele"], [aria-label$="stea"]');
if ((await wStars.count()) >= 4) {
  await wStars.nth(3).click();
  await workerPage.getByRole("button", { name: "Trimite evaluarea" }).click();
  await workerPage.waitForTimeout(800);
  console.log("worker rated poster");
}
await workerPage.screenshot({ path: "/workspace/screenshots/v6-worker-rate.png" });

await workerPage.goto(`${BASE}/cont?tab=apps`, { waitUntil: "load" });
await workerPage.waitForTimeout(600);
const cancelBtn = workerPage.getByRole("button", { name: "Nu mai pot veni" });
if (await cancelBtn.count()) {
  await cancelBtn.click();
  await workerPage.waitForTimeout(700);
  console.log("worker cancelled after complete");
}

await page.goto(`${BASE}/aplicatii`, { waitUntil: "load" });
await page.waitForTimeout(800);
const afterCancel = await page.locator("body").innerText();
console.log({
  reactivateAfterCancel: afterCancel.includes("Reactivează"),
  locuri: afterCancel.includes("loc"),
});
await page.screenshot({ path: "/workspace/screenshots/v6-reactivate.png" });
if (afterCancel.includes("Reactivează")) {
  await page.getByRole("button", { name: "Reactivează jobul" }).click();
  await page.waitForTimeout(900);
  const reactivated = await page.locator("body").innerText();
  console.log({ reactivatedActive: reactivated.includes("Activ") });
}

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(700);
const listedAfterReactivate = (await page.locator("body").innerText()).includes(jobTitle);
console.log({ listedAfterReactivate });

await page.goto(`${BASE}/aplicatii`, { waitUntil: "load" });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Anulează" }).first().click();
await page.waitForTimeout(1000);
const cancelledInbox = await page.locator("body").innerText();
console.log({ cancelledBadge: cancelledInbox.includes("Anulat") });
await page.screenshot({ path: "/workspace/screenshots/v6-cancelled-inbox.png" });

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(700);
const hiddenAfterCancel = !(await page.locator("body").innerText()).includes(jobTitle);
console.log({ hiddenAfterCancel });

if (jobId) {
  await page.goto(`${BASE}/jobs/${jobId}`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const cancelledDetail = await page.locator("body").innerText();
  console.log({
    cancelledDetail: cancelledDetail.includes("anulat") || cancelledDetail.includes("Anulat"),
    applyGone: !cancelledDetail.includes("Cînd poți ajunge"),
  });
  await page.screenshot({ path: "/workspace/screenshots/v6-cancelled-detail.png" });
}

await page.goto(`${BASE}/post`, { waitUntil: "load" });
await page.waitForTimeout(400);
await page.locator('input[placeholder="Ex: Mutare canapea la etajul 3"]').fill(deleteTitle);
await page.locator("textarea").fill("Anunț temporar ca să testăm ștergerea permanentă a jobului din inbox.");
await page.getByPlaceholder("06xxxxxxxx").fill("069333333");
await page.getByRole("button", { name: "Publică anunțul" }).click();
await page.waitForURL(/\/jobs\/\d+/, { timeout: 20000 });
const delId = page.url().match(/\/jobs\/(\d+)/)?.[1];
await page.goto(`${BASE}/aplicatii`, { waitUntil: "load" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Șterge" }).first().click();
await page.waitForTimeout(800);
if (delId) {
  await page.goto(`${BASE}/jobs/${delId}`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const missing = await page.locator("body").innerText();
  console.log({ deletedGone: missing.includes("nu există") || missing.includes("Nu există") });
}

const posterIdMatch = await page.evaluate(async () => {
  return document.cookie.slice(0, 40);
});
console.log({ cookieSnippet: posterIdMatch });

await page.goto(`${BASE}/cont?tab=ratings`, { waitUntil: "load" });
await page.waitForTimeout(800);
const ratingsTab = await page.locator("body").innerText();
console.log({
  posterReviews: ratingsTab.includes("recenzie") || ratingsTab.includes("recenzii") || ratingsTab.includes("4,"),
  profileLink: ratingsTab.includes("profilul public") || ratingsTab.includes("Profilul tău"),
});
await page.screenshot({ path: "/workspace/screenshots/v6-ratings.png" });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.waitForTimeout(700);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
);
console.log({ mobileOverflow: overflow });
await page.screenshot({ path: "/workspace/screenshots/v6-home-mobile.png" });

await browser.close();
console.log("QA DONE");
