import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";

const out = "/workspace/screenshots";
await mkdir(out, { recursive: true });
const errors = [];
const origin = "http://127.0.0.1:8080";

function check(cond, msg) {
  if (!cond) {
    errors.push(msg);
    console.log("FAIL", msg);
  } else console.log("OK", msg);
}

const sw = await (await fetch(`${origin}/sw.js`)).text();
check(sw.includes('addEventListener("push"'), "sw push handler");
check(sw.includes('addEventListener("notificationclick"'), "sw click handler");
check(sw.includes("/icon-192.png"), "sw icon");

const mig = await readFile("/workspace/migrations/0009_push.sql", "utf8");
check(mig.includes("fcm_token"), "migration fcm_token");
check(mig.includes("notify_raion"), "migration raion");
check(mig.includes("push_devices"), "migration devices");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "allow",
  permissions: ["notifications"],
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
await page.addInitScript(() => {
  sessionStorage.setItem("rabotaem-splash", "1");
});
await page.goto(origin + "/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1200);

const early = await page.getByTestId("push-prompt").count();
check(early === 0, "no prompt while signed out");

const key = await page.evaluate(async () => {
  const mod = await import("/src/lib/push.ts");
  return mod.getPushPublicKey();
});
console.log("VAPID", typeof key?.publicKey, key?.publicKey ? key.publicKey.slice(0, 12) : key);
check(typeof key?.publicKey === "string" && key.publicKey.length > 20, "vapid public key");

const swState = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return { active: Boolean(reg.active), script: reg.active?.scriptURL ?? "" };
});
check(swState.active && String(swState.script).includes("/sw.js"), `sw ${swState.script}`);

await page.goto(origin + "/cont", { waitUntil: "networkidle" });
const login = page.url().includes("/login");
check(login, "account gated");

await page.screenshot({ path: `${out}/push-home.png` });
await page.goto(origin + "/", { waitUntil: "networkidle" });
await page.screenshot({ path: `${out}/push-home2.png` });

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
check(!overflow, "no overflow");
check(await page.getByTestId("chat-fab").isVisible(), "chat still there");

await browser.close();
console.log("ERRORS", errors);
if (errors.length) process.exit(1);
