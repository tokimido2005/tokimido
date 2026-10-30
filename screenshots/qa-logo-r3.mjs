import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const OUT = "/workspace/screenshots";

const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"] });

async function open({ dark = false, viewport, path = "/", splash = false } = {}) {
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
    },
    { dark, splash },
  );
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 35000 });
  if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(splash ? 700 : 400);
  return { ctx, page };
}

function report(name, page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img[src*="logo"]')].map((img) => {
      const s = getComputedStyle(img);
      const r = img.getBoundingClientRect();
      return { src: img.getAttribute("src"), display: s.display, w: Math.round(r.width), h: Math.round(r.height) };
    });
    const tags = [...document.querySelectorAll(".logo-tagline, .splash-tagline")].map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.trim(),
        color: s.color,
        size: s.fontSize,
        track: s.letterSpacing,
        w: Math.round(r.width),
        h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && s.opacity !== "0",
      };
    });
    return { imgs, tags };
  }).then((info) => {
    console.log(name, JSON.stringify(info));
    return info;
  });
}

{
  const { ctx, page } = await open({});
  await report("home-light", page);
  await page.screenshot({ path: `${OUT}/r3-home-light.png` });
  const header = page.locator("header .logo-lockup");
  await header.screenshot({ path: `${OUT}/r3-header-light.png` });
  await page.locator(".logo-welcome .logo-lockup").screenshot({ path: `${OUT}/r3-hero-light.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({ dark: true });
  await report("home-dark", page);
  await page.screenshot({ path: `${OUT}/r3-home-dark.png` });
  await page.locator("header .logo-lockup").screenshot({ path: `${OUT}/r3-header-dark.png` });
  await page.locator(".logo-welcome .logo-lockup").screenshot({ path: `${OUT}/r3-hero-dark.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 } });
  await report("home-mobile", page);
  await page.screenshot({ path: `${OUT}/r3-home-mobile.png` });
  await page.locator("header .logo-lockup").screenshot({ path: `${OUT}/r3-header-mobile.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({ dark: true, viewport: { width: 390, height: 844 } });
  await report("home-mobile-dark", page);
  await page.screenshot({ path: `${OUT}/r3-home-mobile-dark.png` });
  await page.locator("header .logo-lockup").screenshot({ path: `${OUT}/r3-header-mobile-dark.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(250);
  await page.locator("footer .logo-lockup").screenshot({ path: `${OUT}/r3-footer-light.png` });
  await page.screenshot({ path: `${OUT}/r3-footer-page-light.png` });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(200);
  await page.locator("footer .logo-lockup").screenshot({ path: `${OUT}/r3-footer-dark.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({ path: "/login" });
  await page.screenshot({ path: `${OUT}/r3-login.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({ path: "/login", dark: true });
  await page.screenshot({ path: `${OUT}/r3-login-dark.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({ splash: true });
  await report("splash", page);
  await page.screenshot({ path: `${OUT}/r3-splash.png` });
  await ctx.close();
}

{
  const { ctx, page } = await open({ splash: true, viewport: { width: 390, height: 844 } });
  await page.screenshot({ path: `${OUT}/r3-splash-mobile.png` });
  await ctx.close();
}

await browser.close();
console.log("done");
