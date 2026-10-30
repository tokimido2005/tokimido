import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "ro-RO" });
await context.addInitScript(() => {
  localStorage.setItem("rabotaem-lang", "ro");
  localStorage.setItem("rabotaem-theme", "light");
  sessionStorage.setItem("rabotaem-splash-v3", "1");
});
const page = await context.newPage();
page.setDefaultTimeout(40000);

async function go(path) {
  await page.goto(base + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
}

await go("/");
const before = await page.locator("a.job-card").count();
console.log("HOME BEFORE", before);

await go("/login");
const user = page.locator('input[autocomplete="username"], input[autocomplete="email"]').first();
await user.waitFor();
await user.fill("tokimido@rabotaem.md");
await page.locator('input[type="password"]').fill("Nascutinanul2005-");
await page.locator('form button[type="submit"]').click();
try {
  await page.waitForURL(/\/admin/, { timeout: 20000 });
} catch {
  console.log("LOGIN FAIL", page.url(), await page.locator("form").innerText());
  await page.screenshot({ path: "/workspace/screenshots/demo-login-fail.png" });
  throw new Error("login failed");
}
console.log("AFTER LOGIN", page.url());

await go("/admin");
await page.getByRole("link", { name: "Anunțuri" }).first().click();
await page.getByTestId("demo-generate").waitFor({ state: "visible", timeout: 15000 });
await page.screenshot({ path: "/workspace/screenshots/demo-admin.png", fullPage: true });

await page.getByTestId("demo-generate").click();
await page.waitForTimeout(3000);
const toast1 = await page.getByText(/publicate|Nu am adăugat|demo/).first().innerText().catch(() => "");
const demoRows = await page.locator('[data-demo="true"]').count();
await page.screenshot({ path: "/workspace/screenshots/demo-generated.png", fullPage: true });
console.log("GENERATE", { toast1: toast1.slice(0, 160), demoRows });

await go("/");
const afterGen = await page.locator("a.job-card").count();
const countLabel = ((await page.locator("main").innerText()).match(/(\d+)\s+anunțuri active/) || [])[1];
console.log("PERSIST", { afterGen, countLabel, persisted: afterGen >= demoRows });

await go("/admin");
await page.getByRole("link", { name: "Anunțuri" }).first().click();
await page.getByTestId("demo-delete").waitFor({ state: "visible" });
await page.getByTestId("demo-delete").click();
await page.waitForTimeout(400);
await page.getByRole("dialog").getByRole("button", { name: "Șterge toate anunțurile demo" }).click();
await page.waitForTimeout(2500);
const toast2 = await page.getByText(/șterse|Nu există anunțuri demo/).first().innerText().catch(() => "");
const demoLeft = await page.locator('[data-demo="true"]').count();
await page.screenshot({ path: "/workspace/screenshots/demo-deleted.png", fullPage: true });
console.log("DELETE", { toast2: toast2.slice(0, 160), demoLeft });

await go("/");
const afterDel = await page.locator("a.job-card").count();
console.log("HOME AFTER DEL", { afterDel, restored: afterDel <= before + 2 });
await browser.close();
