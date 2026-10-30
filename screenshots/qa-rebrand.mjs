import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- splash ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "commit" });
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${OUT}/rebrand-splash-early.png` });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/rebrand-splash-mid.png` });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/rebrand-home-light.png`, fullPage: false });
  const title = await page.title();
  const html = await page.content();
  const body = await page.locator("body").innerText();
  console.log("TITLE", title);
  console.log("has JobPeLoc?", /JobPeLoc/i.test(html + body));
  console.log("has Rabotaem?", /Rabotaem\.md/.test(html + body));
  console.log("has slogan?", /lucru pe loc/i.test(body));
  assert(!/JobPeLoc/i.test(body), "body still mentions JobPeLoc");
  assert(/Rabotaem\.md/.test(html), "Rabotaem.md missing from html");
  assert(/Lucru pe loc/i.test(body) || /lucru pe loc/i.test(body), "slogan missing");
  const logo = page.locator('header img[alt="Rabotaem.md"]');
  await logo.first().waitFor({ state: "visible" });
  const box = await logo.first().boundingBox();
  console.log("header logo box", box);
  await ctx.close();
}

// --- dark home + footer ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-theme", "dark");
  });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/rebrand-home-dark.png` });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/rebrand-footer-dark.png` });
  const body = await page.locator("body").innerText();
  assert(/Rabotaem\.md/.test(body), "dark page missing brand");
  assert(!/JobPeLoc/i.test(body), "dark page still JobPeLoc");
  await ctx.close();
}

// --- login + footer light ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-theme", "light");
  });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/rebrand-login.png` });
  const body = await page.locator("body").innerText();
  console.log("login title-ish", body.slice(0, 200).replace(/\n/g, " | "));
  assert(/Rabotaem\.md/.test(body), "login missing brand");
  assert(!/JobPeLoc/i.test(body), "login still JobPeLoc");

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/rebrand-footer-light.png` });
  await ctx.close();
}

// --- mobile ---
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-theme", "light");
  });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/rebrand-home-mobile.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  console.log("mobile overflow", overflow);
  assert(!overflow, "mobile horizontal overflow");

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/rebrand-login-mobile.png` });
  await ctx.close();
}

// --- splash mobile ---
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "commit" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/rebrand-splash-mobile.png` });
  await ctx.close();
}

// --- EN locale ---
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.setItem("rabotaem-lang", "en");
    localStorage.setItem("rabotaem-theme", "light");
  });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/rebrand-home-en.png` });
  const body = await page.locator("body").innerText();
  console.log("EN has slogan?", /Work on the spot/i.test(body));
  assert(/Work on the spot/i.test(body), "EN slogan missing");
  assert(!/JobPeLoc/i.test(body), "EN still JobPeLoc");
  await ctx.close();
}

console.log("QA OK");
await browser.close();
