import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const out = "/workspace/screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
}

async function ctx(viewport, dark = false) {
  const context = await browser.newContext({
    viewport,
    colorScheme: dark ? "dark" : "light",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.addInitScript((isDark) => {
    try {
      sessionStorage.setItem("rabotaem-splash", "1");
      localStorage.removeItem("rabotaem-chat-lang");
      sessionStorage.removeItem("rabotaem-chat-thread");
      if (isDark) {
        localStorage.setItem("rabotaem-theme", "dark");
        document.documentElement.classList.add("dark");
      } else {
        localStorage.setItem("rabotaem-theme", "light");
      }
    } catch {}
  }, dark);
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(400);
  return { context, page };
}

function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

const { context: c1, page: p1 } = await ctx({ width: 1280, height: 800 });
const fab = p1.getByTestId("chat-fab");
await fab.waitFor({ state: "visible", timeout: 8000 });
await shot(p1, "chat-fab-light");
await fab.click();
await p1.getByTestId("chat-panel").waitFor({ state: "visible" });
const pickerText = await p1.locator("[data-testid=chat-panel]").innerText();
await shot(p1, "chat-picker-light");
if (!pickerText.includes("În ce limbă doriți să vorbim?")) {
  errors.push("missing RO language prompt");
}
if (!pickerText.includes("На каком языке вы хотите говорить?")) {
  errors.push("missing RU language prompt");
}
await p1.getByTestId("chat-lang-ro").click();
await p1.waitForTimeout(300);
const afterRo = await p1.locator("[data-testid=chat-panel]").innerText();
await shot(p1, "chat-greeting-ro");
if (!afterRo.includes("Bună")) errors.push("missing RO greeting");
await p1.getByTestId("chat-input").fill("Este gratuit? Cine e responsabil pentru plăți?");
await p1.getByTestId("chat-send").click();
await p1.waitForFunction(() => {
  const panel = document.querySelector("[data-testid=chat-panel]");
  return panel && /gratuit|comision|intermediar|răspundere|raspundere/i.test(panel.innerText);
}, { timeout: 28000 });
await shot(p1, "chat-answer-ro");
const ansRo = await p1.locator("[data-testid=chat-panel]").innerText();
console.log("RO_ANSWER_SNIP", ansRo.slice(-500).replace(/\s+/g, " "));

await p1.getByLabel(/Schimbă limba|Сменить язык/).click();
await p1.getByTestId("chat-lang-ru").waitFor({ state: "visible" });
await p1.getByTestId("chat-lang-ru").click();
await p1.waitForTimeout(250);
const afterRu = await p1.locator("[data-testid=chat-panel]").innerText();
await shot(p1, "chat-greeting-ru");
if (!afterRu.includes("Здравствуйте") && !afterRu.includes("Помогу")) {
  errors.push("missing RU greeting");
}
await p1.getByTestId("chat-input").fill("Как разместить работу?");
await p1.getByTestId("chat-send").click();
await p1.waitForFunction(() => {
  const panel = document.querySelector("[data-testid=chat-panel]");
  return panel && /Размест|аккаунт|дату и время|комисс/i.test(panel.innerText);
}, { timeout: 28000 });
await shot(p1, "chat-answer-ru");
const overflowDesk = await overflow(p1);
console.log("OVERFLOW_DESK", overflowDesk);
await c1.close();

const { context: c2, page: p2 } = await ctx({ width: 1280, height: 800 }, true);
await p2.getByTestId("chat-fab").click();
await p2.getByTestId("chat-panel").waitFor({ state: "visible" });
await shot(p2, "chat-picker-dark");
await p2.getByTestId("chat-lang-ro").click();
await p2.waitForTimeout(250);
await shot(p2, "chat-open-dark");
await c2.close();

const { context: c3, page: p3 } = await ctx({ width: 390, height: 844 });
await p3.getByTestId("chat-fab").waitFor({ state: "visible" });
const ovClosed = await overflow(p3);
await p3.getByTestId("chat-fab").click();
await p3.getByTestId("chat-panel").waitFor({ state: "visible" });
await shot(p3, "chat-mobile-picker");
const ovOpen = await overflow(p3);
await p3.getByTestId("chat-lang-ro").click();
await p3.waitForTimeout(250);
await shot(p3, "chat-mobile-open");
const ovThread = await overflow(p3);
const box = await p3.getByTestId("chat-panel").boundingBox();
console.log("OVERFLOW_MOBILE", { closed: ovClosed, open: ovOpen, thread: ovThread, box });
if (ovClosed || ovOpen || ovThread) errors.push("horizontal overflow on mobile");
if (box && box.x + box.width > 390 + 2) errors.push("panel wider than viewport");
await c3.close();

await browser.close();
console.log("ERRORS", errors);
if (errors.length) process.exit(1);
