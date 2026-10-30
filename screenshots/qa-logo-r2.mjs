import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });

async function shot({ name, dark = false, viewport, path = "/", splash = false }) {
  const ctx = await browser.newContext({
    viewport: viewport ?? { width: 1280, height: 860 },
    colorScheme: dark ? "dark" : "light",
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    ({ dark, splash }) => {
      if (!splash) sessionStorage.setItem("rabotaem-splash", "1");
      else sessionStorage.removeItem("rabotaem-splash");
      localStorage.setItem("rabotaem-lang", "ro");
      localStorage.setItem("rabotaem-theme", dark ? "dark" : "light");
      if (dark) document.documentElement.classList.add("dark");
    },
    { dark, splash },
  );
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 35000 });
  if (dark) {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
  }
  await page.waitForTimeout(splash ? 700 : 350);

  const logos = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img[src*="logo"]')];
    return imgs.map((img) => {
      const s = getComputedStyle(img);
      const r = img.getBoundingClientRect();
      return {
        src: img.getAttribute("src"),
        display: s.display,
        w: Math.round(r.width),
        h: Math.round(r.height),
        alt: img.getAttribute("alt"),
      };
    });
  });
  console.log(name, "logos", JSON.stringify(logos));

  await page.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
  return logos;
}

await shot({ name: "r2-home-light" });
await shot({ name: "r2-home-dark", dark: true });
await shot({
  name: "r2-home-mobile",
  viewport: { width: 390, height: 844 },
});
await shot({
  name: "r2-home-mobile-dark",
  dark: true,
  viewport: { width: 390, height: 844 },
});
await shot({ name: "r2-login", path: "/login" });
await shot({ name: "r2-login-dark", path: "/login", dark: true });

const ctxF = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pageF = await ctxF.newPage();
await pageF.addInitScript(() => {
  sessionStorage.setItem("rabotaem-splash", "1");
  localStorage.setItem("rabotaem-lang", "ro");
  localStorage.setItem("rabotaem-theme", "light");
});
await pageF.goto(BASE, { waitUntil: "networkidle", timeout: 35000 });
await pageF.waitForTimeout(300);
await pageF.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await pageF.waitForTimeout(250);
await pageF.screenshot({ path: `${OUT}/r2-footer-light.png` });
await pageF.evaluate(() => document.documentElement.classList.add("dark"));
await pageF.waitForTimeout(200);
await pageF.screenshot({ path: `${OUT}/r2-footer-dark.png` });
await ctxF.close();

const ctxS = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const pageS = await ctxS.newPage();
await pageS.addInitScript(() => {
  sessionStorage.removeItem("rabotaem-splash");
  localStorage.setItem("rabotaem-theme", "light");
});
await pageS.goto(BASE, { waitUntil: "domcontentloaded", timeout: 35000 });
await pageS.waitForTimeout(650);
await pageS.screenshot({ path: `${OUT}/r2-splash.png` });
await ctxS.close();

const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 } });
const pageM = await ctxM.newPage();
await pageM.addInitScript(() => {
  sessionStorage.removeItem("rabotaem-splash");
});
await pageM.goto(BASE, { waitUntil: "domcontentloaded", timeout: 35000 });
await pageM.waitForTimeout(650);
await pageM.screenshot({ path: `${OUT}/r2-splash-mobile.png` });
await ctxM.close();

await browser.close();
console.log("done");
