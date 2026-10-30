import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const errors = [];

async function open(path, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${path} ${e.message}`));
  await page.addInitScript(() => {
    sessionStorage.setItem("rabotaem-splash", "1");
    localStorage.removeItem("rabotaem-chat-lang");
    sessionStorage.removeItem("rabotaem-chat-thread");
  });
  await page.goto(`http://127.0.0.1:8080${path}`, { waitUntil: "networkidle", timeout: 30000 });
  return { context, page };
}

const { context: a, page: login } = await open("/login");
const fabLogin = await login.getByTestId("chat-fab").isVisible();
console.log("LOGIN_FAB", fabLogin);
await login.getByTestId("chat-fab").click();
await login.getByTestId("chat-lang-ro").waitFor({ state: "visible" });
await login.screenshot({ path: "/workspace/screenshots/chat-login.png" });
await a.close();

const { context: b, page: home } = await open("/");
await home.getByTestId("chat-fab").click();
await home.getByTestId("chat-lang-ro").click();
await home.getByRole("button", { name: "Cum postez un job?" }).click();
await home.waitForFunction(() => {
  const bots = [...document.querySelectorAll(".chat-bubble-bot")].filter((el) => !el.classList.contains("chat-typing"));
  return bots.length >= 2 && /Postează|cont|dată|ora/i.test(bots.at(-1)?.textContent ?? "");
}, { timeout: 28000 });
const last = await home.locator(".chat-bubble-bot:not(.chat-typing)").last().innerText();
console.log("CHIP_ANSWER", last.slice(0, 280));
await home.screenshot({ path: "/workspace/screenshots/chat-chip-post.png" });
const overflow = await home.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
console.log("OVERFLOW", overflow);
await b.close();

await browser.close();
console.log("ERRORS", errors);
if (!fabLogin || errors.length) process.exit(1);
