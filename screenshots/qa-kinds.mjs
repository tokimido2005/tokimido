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
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return { page, errors, context };
}

const { page, errors } = await withRo({ width: 1280, height: 900 });
page.setDefaultTimeout(20000);

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const homeText = await page.locator("main").innerText();
await page.screenshot({ path: "/workspace/screenshots/kinds-home.png", fullPage: true });

const checks = {
  ctaWork: homeText.includes("Cauți de lucru?"),
  ctaPost: homeText.includes("Ai nevoie de lucrători?"),
  tabs: homeText.includes("Caut lucru rapid") && homeText.includes("Caut angajare"),
  oficialSection: homeText.includes("Angajare oficială"),
  kalim: /Kalîm|Lucru rapid/.test(homeText),
  mixedHint: /Vânzător magazin|Ospătar restaurant/.test(homeText),
};
console.log("HOME CHECKS", checks);
console.log("HOME SNIPPET\n", homeText.slice(0, 700));

await page.goto(base + "/angajare", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const angText = await page.locator("main").innerText();
await page.screenshot({ path: "/workspace/screenshots/kinds-angajare.png", fullPage: true });
console.log("ANGAJARE", {
  title: angText.includes("Angajare oficială"),
  tabs: angText.includes("Caut lucru rapid") && angText.includes("Caut angajare"),
  salary: /MDL \/ lună|Negociabil/.test(angText),
  noRapidPay: !/pe loc/.test(angText.slice(0, 400)),
});
console.log("ANG SNIPPET\n", angText.slice(0, 600));

const { page: mobile } = await withRo({ width: 390, height: 844 });
await mobile.goto(base + "/", { waitUntil: "networkidle" });
await mobile.waitForTimeout(600);
await mobile.screenshot({ path: "/workspace/screenshots/kinds-home-mobile.png", fullPage: true });
const tabLabels = await mobile.locator(".tab-bar").innerText();
console.log("TAB BAR", tabLabels.replace(/\s+/g, " "));
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
console.log("MOBILE OVERFLOW", overflow);

console.log("PAGE ERRORS", errors.slice(0, 12));
await browser.close();
