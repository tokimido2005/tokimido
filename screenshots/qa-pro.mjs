import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function open(viewport, locale = "en-US") {
  const context = await browser.newContext({ viewport, locale });
  await context.addInitScript(() => {
    localStorage.removeItem("rabotaem-lang");
    localStorage.setItem("rabotaem-theme", "light");
    sessionStorage.setItem("rabotaem-splash-v3", "1");
  });
  const page = await context.newPage();
  return { page, context };
}

const { page } = await open({ width: 1280, height: 900 }, "en-US");
page.setDefaultTimeout(25000);
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const homeText = await page.locator("main").innerText();
const footerText = await page.locator("footer").innerText();
await page.screenshot({ path: "/workspace/screenshots/pro-home.png", fullPage: true });
await page.screenshot({ path: "/workspace/screenshots/pro-home-hero.png", clip: { x: 0, y: 0, width: 1280, height: 560 } });

const cards = page.locator("a.job-card");
const cardCount = await cards.count();
const titles = [];
const urgentCount = [];
for (let i = 0; i < cardCount; i++) {
  const t = (await cards.nth(i).innerText()).replace(/\s+/g, " ").trim();
  titles.push(t.split(" ")[0] + " | " + t);
  if (/\bUrgent\b/.test(t)) urgentCount.push(t.slice(0, 60));
}
const titleOnly = [];
for (let i = 0; i < cardCount; i++) {
  titleOnly.push((await cards.nth(i).locator("h3").innerText()).trim());
}
const uniqueTitles = new Set(titleOnly);
const countLabel = (homeText.match(/(\d+)\s+anunțuri active/) || [])[1];
const firstCard = cardCount ? await cards.first().innerText() : "";

console.log("LANG", {
  h1: homeText.includes("Lucru pe loc. Bani pe loc."),
  ctaRo: homeText.includes("Cauți de lucru?") && homeText.includes("Ai nevoie de lucrători?"),
  notEnglishH1: !homeText.includes("Work on the spot"),
});
console.log("HOME", {
  categoryTiles: homeText.includes("Mutări & Transport") && homeText.includes("Ridicare, transport"),
  oficialBlock: homeText.includes("Caut angajare") && homeText.includes("Postez angajare"),
  rails: homeText.includes("În următoarele 3 ore") || homeText.includes("Joburi astăzi"),
  allMoldova: homeText.includes("Toată Moldova"),
  pickRaion: homeText.includes("Alege mai întâi raionul") || homeText.includes("Alege mai întîi raionul"),
  countLabel,
  cardCount,
  uniqueTitles: uniqueTitles.size,
  duplicates: titleOnly.length - uniqueTitles.size,
  urgentCards: urgentCount.length,
  disclaimer: homeText.includes("nu este angajator"),
});
console.log("CARD SAMPLE", firstCard.replace(/\s+/g, " ").slice(0, 280));
console.log("TRUST", {
  hasPublisher: /Andrei|Elena|Ion|Tatiana|Mihai/.test(firstCard),
  verifiedSome: homeText.includes("Telefon verificat"),
});
console.log("FOOTER", {
  moderation: footerText.includes("Moderare"),
  admin: footerText.includes("/admin") || /Moderare/.test(footerText),
});
console.log("URGENT SAMPLES", urgentCount.slice(0, 5));
console.log("TITLES", titleOnly);

await cards.first().screenshot({ path: "/workspace/screenshots/pro-card.png" });

const { page: mobile } = await open({ width: 390, height: 844 }, "en-US");
await mobile.goto(base + "/", { waitUntil: "networkidle" });
await mobile.waitForTimeout(4200);
await mobile.screenshot({ path: "/workspace/screenshots/pro-mobile.png", fullPage: true });
await mobile.screenshot({ path: "/workspace/screenshots/pro-mobile-chrome.png", clip: { x: 0, y: 500, width: 390, height: 344 } });
const fab = mobile.getByTestId("chat-fab");
const tab = mobile.locator(".tab-bar");
const fabBox = await fab.boundingBox();
const tabBox = await tab.boundingBox();
console.log("MOBILE", {
  fab: fabBox ? { w: Math.round(fabBox.width), h: Math.round(fabBox.height), y: Math.round(fabBox.y) } : null,
  tabY: tabBox ? Math.round(tabBox.y) : null,
  overlap: fabBox && tabBox ? fabBox.y + fabBox.height > tabBox.y + 2 : null,
  overflow: await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2),
  lang: (await mobile.locator("h1").innerText()).includes("Lucru pe loc"),
});

await browser.close();
