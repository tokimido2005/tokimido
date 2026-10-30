import { chromium } from "playwright";

const BASE = "http://127.0.0.1:8080";
const uid = String(Date.now()).slice(-7);
const email = `ban${uid}@jobpeloc.test`;
const password = "Parola123";
const ADMIN_EMAIL = "tokimido@rabotaem.md";
const ADMIN_PASS = "Nascutinanul2005-";

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

function attach(page, label) {
  page.on("pageerror", (e) => console.log(label, "PAGEERROR", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log(label, "CONSOLE", m.text().slice(0, 220));
  });
}

async function newPage(label) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("rabotaem-splash-v3", "1");
      localStorage.setItem("rabotaem-onboarded", "1");
      localStorage.setItem("rabotaem-lang", "ro");
      localStorage.setItem("rabotaem-theme", "light");
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  attach(page, label);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator(".splash").waitFor({ state: "hidden", timeout: 4000 }).catch(() => {});
  return { context, page };
}

async function apiSignUp(page, body) {
  return page.evaluate(async (payload) => {
    const r = await fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return { status: r.status, text: await r.text() };
  }, body);
}

async function apiSignIn(page, body) {
  return page.evaluate(async (payload) => {
    const r = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return { status: r.status, text: await r.text() };
  }, body);
}

const results = {};

const { page: userPage, context: userCtx } = await newPage("USER");
results.signup = await apiSignUp(userPage, { name: "Ion Testban", email, password });
console.log("signup", results.signup.status, results.signup.text.slice(0, 180));
await userCtx.close();

const { page: adminPage, context: adminCtx } = await newPage("ADMIN");
await adminPage.evaluate(async () => {
  await fetch("/api/auth/_prime", { method: "GET" }).catch(() => {});
});
results.prime = await adminPage.evaluate(async () => {
  await fetch("/_serverFn/src_lib_admin_ts--primeAdmin", { method: "GET" }).catch(() => {});
  return true;
}).catch(() => false);

results.adminSign = await apiSignIn(adminPage, { email: ADMIN_EMAIL, password: ADMIN_PASS });
console.log("adminSign", results.adminSign.status, results.adminSign.text.slice(0, 220));
await adminPage.goto(`${BASE}/admin?tab=users`, { waitUntil: "domcontentloaded", timeout: 45000 });
await adminPage.waitForTimeout(1500);
results.adminUrl = adminPage.url();
results.adminBody = (await adminPage.locator("body").innerText()).slice(0, 300);
console.log("admin url", results.adminUrl);
await adminPage.screenshot({ path: "/workspace/artifacts/qa-admin-users.png", fullPage: true });

if (!adminPage.url().includes("/admin") || /Intră în/.test(results.adminBody)) {
  throw new Error(`admin not in panel: ${results.adminUrl} ${results.adminBody}`);
}

const search = adminPage.locator('input[placeholder*="Caută"]').first();
await search.fill(email);
await adminPage.waitForTimeout(900);
results.usersPane = (await adminPage.locator("main").innerText()).slice(0, 400);
const userBtn = adminPage.getByRole("button", { name: /Ion Testban/i }).first();
if ((await userBtn.count()) === 0) {
  throw new Error(`user not in list: ${results.usersPane}`);
}
await userBtn.click();
await adminPage.waitForTimeout(600);

results.reasonChips = await adminPage.getByTestId("ban-reason-chip").count();
const ban3 = adminPage.getByRole("button", { name: /^3 zile$/i });
results.banDisabledBeforeReason = (await ban3.count()) === 0 || (await ban3.isDisabled().catch(() => true));

await adminPage.getByPlaceholder("Titlu").fill("Mesaj admin");
await adminPage.locator("textarea").first().fill("Te rugăm să citești regulamentul platformei.");
await adminPage.getByRole("button", { name: "Trimite" }).click();
await adminPage.waitForTimeout(1000);

const { page: inboxUser, context: inboxUserCtx } = await newPage("INBOX-USER");
await apiSignIn(inboxUser, { email, password });
await inboxUser.goto(`${BASE}/cont?tab=inbox`, { waitUntil: "domcontentloaded", timeout: 45000 });
await inboxUser.waitForTimeout(2000);
results.inboxHasAdmin = (await inboxUser.locator("body").innerText()).includes("De la admin");
const msgId = await inboxUser.locator("[id^='inbox-msg-']").first().getAttribute("id");
results.inboxMsgId = msgId;
if (msgId) {
  const n = msgId.replace("inbox-msg-", "");
  await inboxUser.goto(`${BASE}/cont?tab=inbox&msg=${n}`, { waitUntil: "domcontentloaded" });
  await inboxUser.waitForTimeout(1200);
  results.inboxHighlight = (await inboxUser.getByTestId("inbox-highlight").count()) > 0;
}
await inboxUser.screenshot({ path: "/workspace/artifacts/qa-inbox.png", fullPage: true });
await inboxUserCtx.close();

await adminPage.getByTestId("ban-reason-chip").filter({ hasText: /Spam/i }).click();
await adminPage.waitForTimeout(200);
await adminPage.getByRole("button", { name: /Avertisment/i }).click();
await adminPage.waitForTimeout(1400);

results.banEnabledAfterWarn = await ban3.isEnabled().catch(() => false);
await ban3.click();
await adminPage.waitForTimeout(1500);

await adminPage.goto(`${BASE}/admin?tab=log`, { waitUntil: "domcontentloaded" });
await adminPage.waitForTimeout(700);
await adminPage.getByTestId("admin-log-bans").click();
await adminPage.waitForTimeout(900);
results.logHasBan = (await adminPage.getByTestId("admin-ban-log-row").count()) > 0;
results.logText = (await adminPage.locator("main").innerText()).slice(0, 500);
await adminPage.screenshot({ path: "/workspace/artifacts/qa-admin-log.png", fullPage: true });
await adminCtx.close();

const { page: bannedPage, context: bannedCtx } = await newPage("BANNED");
results.userSign = await apiSignIn(bannedPage, { email, password });
console.log("userSign", results.userSign.status);
await bannedPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 });
await bannedPage.waitForTimeout(2000);
results.banVisible = (await bannedPage.getByTestId("ban-screen").count()) > 0;
results.banTemporary = (await bannedPage.getByTestId("ban-temporary").count()) > 0;
results.banTitle = await bannedPage.locator("h1").first().innerText().catch(() => "");
results.banReason = await bannedPage.getByTestId("ban-reason").innerText().catch(() => "");
results.normalNavHidden = (await bannedPage.getByRole("link", { name: /^Joburi$/ }).count()) === 0;
await bannedPage.screenshot({ path: "/workspace/artifacts/qa-ban-temporary.png", fullPage: true });

await bannedPage.goto(`${BASE}/post`, { waitUntil: "domcontentloaded" });
await bannedPage.waitForTimeout(1200);
results.banOnPost = (await bannedPage.getByTestId("ban-screen").count()) > 0;
await bannedCtx.close();

const { page: admin2, context: admin2Ctx } = await newPage("ADMIN2");
results.admin2Sign = await apiSignIn(admin2, { email: ADMIN_EMAIL, password: ADMIN_PASS });
await admin2.goto(`${BASE}/admin?tab=users`, { waitUntil: "domcontentloaded" });
await admin2.waitForTimeout(800);
await admin2.locator('input[placeholder*="Caută"]').first().fill(email);
await admin2.waitForTimeout(800);
await admin2.getByRole("button", { name: /Ion Testban/i }).first().click();
await admin2.waitForTimeout(500);
await admin2.getByRole("complementary").getByRole("button", { name: /Deblochează/i }).click();
await admin2.waitForTimeout(900);
await admin2.getByTestId("ban-reason-chip").filter({ hasText: /Spam/i }).click();
await admin2.getByRole("button", { name: /Permanent/i }).click();
await admin2.waitForTimeout(1200);
await admin2Ctx.close();

const { page: permPage, context: permCtx } = await newPage("PERM");
await apiSignIn(permPage, { email, password });
await permPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await permPage.waitForTimeout(2000);
results.banPermanent = (await permPage.getByTestId("ban-permanent").count()) > 0;
results.permTitle = await permPage.locator("h1").first().innerText().catch(() => "");
await permPage.screenshot({ path: "/workspace/artifacts/qa-ban-permanent.png", fullPage: true });
await permCtx.close();

const { page: inboxPage, context: inboxCtx } = await newPage("INBOX");
await apiSignIn(inboxPage, { email: ADMIN_EMAIL, password: ADMIN_PASS });
await inboxPage.goto(`${BASE}/admin?tab=messages`, { waitUntil: "domcontentloaded" });
await inboxPage.waitForTimeout(800);
results.messagesHint = /notificare|push/i.test(await inboxPage.locator("main").innerText());
await inboxPage.screenshot({ path: "/workspace/artifacts/qa-admin-messages.png" });
await inboxCtx.close();

console.log(JSON.stringify(results, null, 2));
await browser.close();
