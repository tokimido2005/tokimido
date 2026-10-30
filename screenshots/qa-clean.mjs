import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function withRo(viewport) {
  const context = await browser.newContext({ viewport, locale: "ro-RO" });
  await context.addInitScript(() => {
    localStorage.setItem("rabotaem-lang", "ro");
    localStorage.setItem("rabotaem-theme", "light");
    sessionStorage.setItem("rabotaem-splash-v3", "1");
    sessionStorage.setItem("rabotaem-onboarded", "1");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { page, errors, context };
}

const { page, errors } = await withRo({ width: 1280, height: 900 });
page.setDefaultTimeout(25000);

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const homeText = await page.locator("main").innerText();
await page.screenshot({ path: "/workspace/screenshots/clean-home.png", fullPage: true });
await page.screenshot({ path: "/workspace/screenshots/clean-home-hero.png", clip: { x: 0, y: 0, width: 1280, height: 620 } });

const heroLogos = await page.locator("main img[alt='Rabotaem.md']").count();
const sloganCount = (homeText.match(/Lucru pe loc\. Bani pe loc\./gi) || []).length;
const ctaWork = await page.getByRole("link", { name: "Cauți de lucru?" }).count();
const ctaPost = await page.getByRole("link", { name: "Ai nevoie de lucrători?" }).count();
const searchInHero = await page.locator("section").first().locator("input").count();
const disclaimer = homeText.includes("Rabotaem.md nu este angajator");
const activeCount = /anunțuri active/.test(homeText);

console.log("HOME", {
  heroLogos,
  sloganCount,
  ctaWork,
  ctaPost,
  searchInHero,
  disclaimer,
  activeCount,
  hasSubtitleOld: homeText.includes("Joburi scurte în toată Moldova"),
  hasStats: homeText.includes("0% comision") || homeText.includes("Totul e gratuit"),
});

const card = page.locator("a.job-card").first();
const cardText = await card.innerText();
console.log("CARD", {
  hasDateTime: /\d{2}\.\d{2}\.\d{4}/.test(cardText) || cardText.includes("Data") || cardText.includes("Ora"),
  hasSpots: /Locuri|din \d/.test(cardText),
  hasTitle: cardText.length > 8,
  snippet: cardText.replace(/\s+/g, " ").slice(0, 220),
});
await card.screenshot({ path: "/workspace/screenshots/clean-card.png" });

await card.click();
await page.waitForTimeout(700);
const jobText = await page.locator("main").innerText();
await page.screenshot({ path: "/workspace/screenshots/clean-job.png", fullPage: true });
console.log("JOB", {
  date: jobText.includes("Data"),
  time: jobText.includes("Ora"),
  spots: jobText.includes("Locuri"),
  verified: jobText.includes("Telefon verificat"),
  rating: /★|4,|5,|\d,\d/.test(jobText) || jobText.includes("stele") || page.locator("main").getByText(/4,|5,/).count(),
  apply: jobText.includes("Aplică"),
  disclaimer: jobText.includes("nu este angajator"),
});

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const raionBtn = page.getByRole("button", { name: /Toate raioanele/i }).first();
if (await raionBtn.count()) {
  await raionBtn.click();
  await page.waitForTimeout(200);
  const option = page.getByRole("option", { name: "Cantemir" }).or(page.getByText("Cantemir", { exact: true }));
  if (await option.count()) {
    await option.first().click();
  } else {
    await page.keyboard.type("Cantemir");
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(800);
}
const emptyText = await page.locator("main").innerText();
await page.screenshot({ path: "/workspace/screenshots/clean-empty-raion.png", fullPage: true });
console.log("EMPTY RAION", {
  message: emptyText.includes("Nu sunt anunțuri în această zonă"),
  cta: emptyText.includes("Vezi toată Moldova"),
});

const { page: mobile } = await withRo({ width: 390, height: 844 });
await mobile.goto(base + "/", { waitUntil: "networkidle" });
await mobile.waitForTimeout(4200);
await mobile.screenshot({ path: "/workspace/screenshots/clean-home-mobile.png", fullPage: true });
await mobile.screenshot({ path: "/workspace/screenshots/clean-mobile-chrome.png", clip: { x: 0, y: 500, width: 390, height: 344 } });

const fab = mobile.getByTestId("chat-fab");
const tab = mobile.locator(".tab-bar");
const fabBox = await fab.boundingBox();
const tabBox = await tab.boundingBox();
const fabSize = fabBox ? { w: Math.round(fabBox.width), h: Math.round(fabBox.height), y: Math.round(fabBox.y) } : null;
const overlap = fabBox && tabBox ? fabBox.y + fabBox.height > tabBox.y + 4 : null;
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
console.log("MOBILE", {
  fabSize,
  tabY: tabBox ? Math.round(tabBox.y) : null,
  overlap,
  overflow,
  tabText: (await tab.innerText()).replace(/\s+/g, " "),
});

console.log("PAGE ERRORS", errors.slice(0, 12));
await browser.close();
