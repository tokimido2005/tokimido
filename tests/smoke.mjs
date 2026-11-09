#!/usr/bin/env node
/**
 * Smoke test run by CI (and locally): seeds a few accounts + listings, then opens
 * the main pages in Chromium and fails on any crash ("Ceva n-a mers") or page error.
 *
 *   BASE_URL=http://127.0.0.1:8080 DATABASE_URL=postgres://… node tests/smoke.mjs
 */
import pg from "pg";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080";
const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const PASSWORD = "SmokeTest12345";
const failures = [];
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.log(`  ✗ ${msg}`);
  failures.push(msg);
};

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + "/");
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("server did not start");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signUp(name) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch(BASE + "/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email: `${name}@smoke.test`, password: PASSWORD, name }),
    });
    if (r.status === 429) {
      await sleep(8000);
      continue;
    }
    if (!r.ok && r.status !== 422) throw new Error(`sign-up ${name}: ${r.status} ${await r.text()}`);
    return;
  }
  throw new Error(`sign-up ${name}: rate limited`);
}

async function seed() {
  for (const n of ["poster", "worker"]) await signUp(n);
  const client = new pg.Client({ connectionString: DB });
  await client.connect();
  try {
    const users = Object.fromEntries(
      (await client.query(`select id, email from "user" where email like '%@smoke.test'`)).rows.map((r) => [
        r.email.split("@")[0],
        r.id,
      ]),
    );
    let phone = 69100001;
    for (const [name, id] of Object.entries(users)) {
      await client.query(
        `insert into profiles (user_id, first_name, last_name, phone, phone_verified_at, accepted_rules_at, birth_year)
         values ($1, $2, 'Test', $3, now(), now(), 1990)
         on conflict (user_id) do update set phone_verified_at = now(), birth_year = 1990`,
        [id, name, `0${phone++}`],
      );
    }
    const job = (title, kind, details) =>
      client.query(
        `insert into jobs (user_id, title, description, category, raion, locality, payment_mdl, duration_minutes,
                           people_needed, poster_name, status, starts_at, kind, company, salary_period, details)
         values ($1, $2, 'Descriere de test suficient de lungă.', $3, 'Chișinău', 'Centru', 800, 120, 2,
                 'Poster Test', 'open', now() + interval '2 days', $4, $5, $6, $7::jsonb) returning id`,
        [
          users.poster,
          title,
          kind === "oficial" ? "vanzari" : "casnic",
          kind,
          kind === "oficial" ? "Firma Test SRL" : "",
          kind === "oficial" ? "month" : "spot",
          JSON.stringify(details ?? {}),
        ],
      );
    const rapid = (await job("Lucru rapid de test", "rapid")).rows[0].id;
    const oldOfficial = (await job("Angajare veche fără detalii", "oficial")).rows[0].id;
    const newOfficial = (
      await job("Angajare cu detalii", "oficial", {
        responsibilities: "Servire clienți",
        requirements: "Punctualitate",
        offer: "Salariu oficial",
        languages: ["ro"],
        salary_max: 12000,
      })
    ).rows[0].id;
    return { rapid, oldOfficial, newOfficial };
  } finally {
    await client.end();
  }
}

async function main() {
  await waitForServer();
  const ids = await seed();
  console.log("Seeded:", ids);
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  try {
    for (const as of [null, "worker", "poster"]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      await ctx.addInitScript(() => {
        try {
          localStorage.setItem("rabotaem-onboarded", "1");
          sessionStorage.setItem("rabotaem-splash-v23", "1");
        } catch {
          /* blob/iframe documents */
        }
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      if (as) {
        let r;
        for (let i = 0; i < 8; i++) {
          r = await page.request.post(BASE + "/api/auth/sign-in/email", {
            headers: { origin: BASE },
            data: { email: `${as}@smoke.test`, password: PASSWORD },
          });
          if (r.status() !== 429) break;
          await sleep(8000);
        }
        if (!r.ok()) fail(`sign-in ${as}: ${r.status()}`);
      }
      const paths = [
        "/",
        "/angajare",
        `/jobs/${ids.rapid}`,
        `/jobs/${ids.oldOfficial}`,
        `/jobs/${ids.newOfficial}`,
        "/confidentialitate",
        "/termeni",
        ...(as ? ["/aplicatii", "/cont", "/cv", "/post"] : []),
      ];
      console.log(`As ${as ?? "visitor"}:`);
      for (const path of paths) {
        errors.length = 0;
        const res = await page.goto(BASE + path, { waitUntil: "load" });
        await page.waitForTimeout(1500);
        const text = await page.locator("body").innerText().catch(() => "");
        if (!res || res.status() >= 500) fail(`${path} → HTTP ${res?.status()}`);
        else if (text.includes("Ceva n-a mers")) fail(`${path} → error screen`);
        else if (errors.length) fail(`${path} → ${errors[0]}`);
        else ok(path);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`\n${failures.length} problem(s) found.`);
    process.exit(1);
  }
  console.log("\nAll pages OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
