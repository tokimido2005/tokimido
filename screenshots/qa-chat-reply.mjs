import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const net = [];
page.on("requestfailed", (r) => net.push(`FAIL ${r.method()} ${r.url()} ${r.failure()?.errorText}`));
page.on("response", async (r) => {
  if (r.url().includes("chat") || r.url().includes("_server") || r.url().includes("ask")) {
    net.push(`RES ${r.status()} ${r.url().slice(0, 120)}`);
  }
});
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});
await page.addInitScript(() => {
  sessionStorage.setItem("rabotaem-splash", "1");
  localStorage.removeItem("rabotaem-chat-lang");
  sessionStorage.removeItem("rabotaem-chat-thread");
  localStorage.setItem("rabotaem-theme", "light");
});
await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 30000 });
await page.getByTestId("chat-fab").click();
await page.getByTestId("chat-lang-ro").click();
await page.getByTestId("chat-input").fill("Este gratuit? Cine raspunde pentru plati?");
await page.getByTestId("chat-send").click();
await page.locator(".chat-typing").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
await page.waitForFunction(() => {
  const bots = [...document.querySelectorAll(".chat-bubble-bot")].filter((el) => !el.classList.contains("chat-typing"));
  return bots.length >= 2 && (bots.at(-1)?.textContent?.length ?? 0) > 40;
}, { timeout: 28000 });
const bots = await page.locator(".chat-bubble-bot:not(.chat-typing)").allInnerTexts();
console.log("BOT_COUNT", bots.length);
console.log("LAST", bots.at(-1));
await page.screenshot({ path: "/workspace/screenshots/chat-reply-ro.png" });

await page.getByLabel(/Schimbă limba/).click();
await page.getByTestId("chat-lang-ru").click();
await page.getByTestId("chat-input").fill("Как откликнуться на работу?");
await page.getByTestId("chat-send").click();
await page.waitForFunction(() => {
  const bots = [...document.querySelectorAll(".chat-bubble-bot")].filter((el) => !el.classList.contains("chat-typing"));
  return bots.length >= 2 && /отклик|аккаунт|телефон/i.test(bots.at(-1)?.textContent ?? "");
}, { timeout: 28000 });
const lastRu = await page.locator(".chat-bubble-bot:not(.chat-typing)").last().innerText();
console.log("LAST_RU", lastRu);
await page.screenshot({ path: "/workspace/screenshots/chat-reply-ru.png" });
console.log("NET", net);
await browser.close();
