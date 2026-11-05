import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { getSql } from "@/lib/db";
import { assertPhoneFree, normalizePhone } from "@/lib/safety";

export type SmsPurpose = "verify" | "change" | "reset";

const COOLDOWN_MS = 60_000;
const PER_PHONE_10MIN = 3;
const PER_PHONE_DAY = 5;
const PER_IP_HOUR = 10;
const MAX_WRONG = 5;
const LOCK_MS = 15 * 60_000;
const CODE_TTL_MS = 10 * 60_000;
const TICKET_TTL_MS = 10 * 60_000;

export async function ensureSmsTables() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists sms_codes (
      id serial primary key,
      phone text not null,
      user_id text,
      purpose text not null,
      code_hash text not null,
      expires_at timestamptz not null,
      attempts integer not null default 0,
      locked_until timestamptz,
      ticket_hash text,
      ticket_expires_at timestamptz,
      ip text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  try {
    await sql.query(
      `create unique index if not exists sms_codes_phone_purpose_uidx on sms_codes (phone, purpose)`,
    );
  } catch (err) {
    console.error("[sms] unique index", err);
  }
  await sql.query(`
    create table if not exists sms_log (
      id serial primary key,
      phone text not null default '',
      user_id text,
      ip text not null default '',
      purpose text not null default 'verify',
      event text not null,
      detail text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`create index if not exists sms_log_created_idx on sms_log (created_at desc)`);
  await sql.query(`create index if not exists sms_log_phone_idx on sms_log (phone, created_at desc)`);
  await sql.query(`create index if not exists sms_log_ip_idx on sms_log (ip, created_at desc)`);
}

export function clientIp() {
  try {
    const req = getRequest();
    if (!req) return "unknown";
    const h = req.headers;
    // Render sits behind Cloudflare: True-Client-IP / CF-Connecting-IP are set
    // by the edge and cannot be forged by the client, while X-Forwarded-For is
    // only appended to (its first entry is client-controlled). Use XFF last.
    const xf =
      h.get("true-client-ip") ||
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      h.get("x-forwarded-for") ||
      "";
    const ip = xf.split(",")[0]?.trim() || "unknown";
    return ip.slice(0, 80);
  } catch {
    return "unknown";
  }
}

function toE164(phone: string) {
  const n = normalizePhone(phone).replace(/\D/g, "");
  if (n.startsWith("373")) return `+${n}`;
  if (n.startsWith("0")) return `+373${n.slice(1)}`;
  return `+373${n}`;
}

async function hashValue(parts: string[]) {
  const { createHash } = await import("node:crypto");
  const pepper =
    (typeof process !== "undefined" ? process.env.BETTER_AUTH_SECRET : undefined)?.trim() ||
    "rabotaem-sms-pepper";
  return createHash("sha256").update(`rbt-sms:${pepper}:${parts.join(":")}`).digest("hex");
}

async function randomCode() {
  const { randomInt } = await import("node:crypto");
  return String(randomInt(100000, 1000000));
}

async function randomTicket() {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(24).toString("hex");
}

async function logSms(row: {
  phone: string;
  user_id?: string | null;
  ip: string;
  purpose: string;
  event: string;
  detail?: string;
}) {
  const sql = await getSql();
  await sql.query(
    `insert into sms_log (phone, user_id, ip, purpose, event, detail)
     values ($1, $2, $3, $4, $5, $6)`,
    [row.phone, row.user_id ?? null, row.ip, row.purpose, row.event, row.detail ?? ""],
  );
}

type Delivery = { ok: boolean; detail: string };

async function deliverSms(e164: string, body: string): Promise<Delivery> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  if (!sid || !token || !from) return { ok: false, detail: "twilio_not_configured" };
  try {
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: e164, From: from, Body: body }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return { ok: true, detail: "twilio" };
    // Keep Twilio's own error code + message: it says exactly what to fix
    // (21608 trial/unverified number, 21408 country not enabled, 21212 bad From…).
    let info = "";
    try {
      const data = (await res.json()) as { code?: number; message?: string };
      info = `${data.code ?? ""} ${data.message ?? ""}`.trim();
    } catch {
      info = await res.text().catch(() => "");
    }
    console.error(`[sms] twilio ${res.status} for ${e164.slice(0, 7)}…: ${info}`);
    return { ok: false, detail: `twilio_${res.status} ${info}`.slice(0, 300) };
  } catch (err) {
    console.error("[sms] twilio", err);
    return { ok: false, detail: `twilio_error ${err instanceof Error ? err.message : ""}`.slice(0, 300) };
  }
}

/**
 * Showing the code on screen defeats verification (and lets anyone reset
 * another user's password). Only allowed outside production, or explicitly
 * with SMS_PREVIEW_CODES=1 for a private test deploy.
 */
function previewCodesAllowed() {
  if (process.env.SMS_PREVIEW_CODES?.trim() === "1") return true;
  return process.env.NODE_ENV !== "production";
}

type CodeRow = {
  id: number;
  phone: string;
  user_id: string | null;
  purpose: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  locked_until: string | null;
  ticket_hash: string | null;
  ticket_expires_at: string | null;
  created_at: string;
};

async function assertNotLocked(phone: string, purpose: SmsPurpose) {
  const sql = await getSql();
  const rows = await sql.query<CodeRow>(
    `select * from sms_codes where phone = $1 and purpose = $2`,
    [phone, purpose],
  );
  const row = rows[0];
  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60_000));
    throw new Error(`sms.errLock|${mins}`);
  }
  return row ?? null;
}

export async function assertSendLimits(phone: string, ip: string, purpose: SmsPurpose, userId?: string | null) {
  const sql = await getSql();
  const last = await sql.query<{ created_at: string }>(
    `select created_at from sms_log
     where phone = $1 and event = 'send'
     order by created_at desc limit 1`,
    [phone],
  );
  if (last[0]) {
    const age = Date.now() - new Date(last[0].created_at).getTime();
    if (age < COOLDOWN_MS) {
      const wait = Math.max(1, Math.ceil((COOLDOWN_MS - age) / 1000));
      throw new Error(`sms.errCooldown|${wait}`);
    }
  }
  const ten = await sql.query<{ n: number }>(
    `select count(*)::int as n from sms_log
     where phone = $1 and event in ('send', 'send_failed') and created_at > now() - interval '10 minutes'`,
    [phone],
  );
  if ((ten[0]?.n ?? 0) >= PER_PHONE_10MIN) {
    await logSms({
      phone,
      user_id: userId,
      ip,
      purpose,
      event: "blocked",
      detail: "limit_10min",
    });
    throw new Error("sms.err10min");
  }
  const day = await sql.query<{ n: number }>(
    `select count(*)::int as n from sms_log
     where phone = $1 and event in ('send', 'send_failed') and created_at > now() - interval '1 day'`,
    [phone],
  );
  if ((day[0]?.n ?? 0) >= PER_PHONE_DAY) {
    await logSms({
      phone,
      user_id: userId,
      ip,
      purpose,
      event: "blocked",
      detail: "limit_day",
    });
    throw new Error("sms.errDay");
  }
  if (ip && ip !== "unknown") {
    const hour = await sql.query<{ n: number }>(
      `select count(*)::int as n from sms_log
       where ip = $1 and event in ('send', 'send_failed', 'lookup_miss')
         and created_at > now() - interval '1 hour'`,
      [ip],
    );
    if ((hour[0]?.n ?? 0) >= PER_IP_HOUR) {
      await logSms({
        phone,
        user_id: userId,
        ip,
        purpose,
        event: "blocked",
        detail: "limit_ip",
      });
      throw new Error("sms.errIp");
    }
  }
}

export async function sendSmsCode(opts: {
  phone: string;
  purpose: SmsPurpose;
  userId?: string | null;
}): Promise<{ ok: true; sent: boolean; previewCode?: string; phone: string }> {
  await ensureSmsTables();
  const phone = normalizePhone(opts.phone);
  if (phone.replace(/\D/g, "").length < 8) throw new Error("sms.errPhone");
  const ip = clientIp();
  await assertNotLocked(phone, opts.purpose);
  await assertSendLimits(phone, ip, opts.purpose, opts.userId);

  const code = await randomCode();
  const code_hash = await hashValue([opts.purpose, phone, code]);
  const sql = await getSql();
  await sql.query(`delete from sms_codes where phone = $1 and purpose = $2`, [phone, opts.purpose]);
  await sql.query(
    `insert into sms_codes (phone, user_id, purpose, code_hash, expires_at, attempts, locked_until, ticket_hash, ticket_expires_at, ip, created_at)
     values ($1, $2, $3, $4, now() + interval '10 minutes', 0, null, null, null, $5, now())`,
    [phone, opts.userId ?? null, opts.purpose, code_hash, ip],
  );

  const delivery = await deliverSms(
    toE164(phone),
    `Rabotaem.md: codul tău este ${code}. Valabil 10 minute.`,
  );
  const preview = !delivery.ok && previewCodesAllowed();
  await logSms({
    phone,
    user_id: opts.userId,
    ip,
    purpose: opts.purpose,
    event: delivery.ok ? "send" : "send_failed",
    detail: preview ? `preview (${delivery.detail})` : delivery.detail,
  });
  if (!delivery.ok && !preview) {
    // The code was not delivered: drop it so it cannot be guessed/used, and
    // tell the user instead of pretending the SMS went out.
    await sql.query(`delete from sms_codes where phone = $1 and purpose = $2`, [phone, opts.purpose]);
    throw new Error("sms.errSend");
  }
  return { ok: true as const, sent: delivery.ok, previewCode: preview ? code : undefined, phone };
}

export async function verifySmsCode(opts: {
  phone: string;
  purpose: SmsPurpose;
  code: string;
  userId?: string | null;
}): Promise<{ ok: true; ticket?: string; userId?: string | null }> {
  await ensureSmsTables();
  const phone = normalizePhone(opts.phone);
  const code = opts.code.replace(/\D/g, "");
  const ip = clientIp();
  const sql = await getSql();
  const row = await assertNotLocked(phone, opts.purpose);
  if (!row) throw new Error("sms.errNone");
  if (code.length !== 6) throw new Error("sms.errWrong|5");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await logSms({
      phone,
      user_id: opts.userId ?? row.user_id,
      ip,
      purpose: opts.purpose,
      event: "verify_fail",
      detail: "expired",
    });
    throw new Error("sms.errExpired");
  }

  await sql.query(`update sms_codes set attempts = attempts + 1 where id = $1`, [row.id]);
  const attempts = row.attempts + 1;
  const expected = await hashValue([opts.purpose, phone, code]);
  if (expected !== row.code_hash) {
    if (attempts >= MAX_WRONG) {
      await sql.query(`update sms_codes set locked_until = now() + interval '15 minutes' where id = $1`, [
        row.id,
      ]);
      await logSms({
        phone,
        user_id: opts.userId ?? row.user_id,
        ip,
        purpose: opts.purpose,
        event: "blocked",
        detail: "lockout_15m",
      });
      throw new Error("sms.errLock|15");
    }
    await logSms({
      phone,
      user_id: opts.userId ?? row.user_id,
      ip,
      purpose: opts.purpose,
      event: "verify_fail",
      detail: `wrong_${attempts}`,
    });
    const left = MAX_WRONG - attempts;
    throw new Error(left === 1 ? "sms.errWrongLast" : `sms.errWrong|${left}`);
  }

  await logSms({
    phone,
    user_id: opts.userId ?? row.user_id,
    ip,
    purpose: opts.purpose,
    event: "verify_ok",
    detail: "",
  });

  if (opts.purpose === "reset") {
    const ticket = await randomTicket();
    const ticket_hash = await hashValue(["ticket", phone, ticket]);
    await sql.query(
      `update sms_codes
       set ticket_hash = $1, ticket_expires_at = now() + interval '10 minutes',
           code_hash = '', attempts = 0
       where id = $2`,
      [ticket_hash, row.id],
    );
    return { ok: true as const, ticket, userId: row.user_id };
  }

  await sql.query(`delete from sms_codes where id = $1`, [row.id]);
  return { ok: true as const, userId: row.user_id };
}

export async function consumeResetTicket(opts: { phone: string; ticket: string; password: string }) {
  await ensureSmsTables();
  const phone = normalizePhone(opts.phone);
  const password = opts.password;
  if (password.length < 8) throw new Error("sms.errPassword");
  if (password.length > 80) throw new Error("sms.errPasswordLong");
  const ip = clientIp();
  const sql = await getSql();
  const rows = await sql.query<CodeRow>(
    `select * from sms_codes where phone = $1 and purpose = 'reset'`,
    [phone],
  );
  const row = rows[0];
  if (!row?.ticket_hash || !row.ticket_expires_at) {
    throw new Error("sms.errTicket");
  }
  if (new Date(row.ticket_expires_at).getTime() < Date.now()) {
    throw new Error("sms.errExpired");
  }
  const expected = await hashValue(["ticket", phone, opts.ticket]);
  if (expected !== row.ticket_hash) throw new Error("sms.errTicket");

  const users = await sql.query<{ user_id: string; email: string | null }>(
    `select p.user_id, u.email
     from profiles p
     left join "user" u on u.id = p.user_id
     where p.phone = $1
     limit 1`,
    [phone],
  );
  const user = users[0];
  if (!user) throw new Error("sms.errNoAccount");

  const { hashPassword } = await import("better-auth/crypto");
  const hashed = await hashPassword(password);
  const now = new Date().toISOString();
  const acc = await sql.query<{ id: string }>(
    `select id from account where "userId" = $1 and "providerId" = 'credential'`,
    [user.user_id],
  );
  if (acc[0]) {
    await sql.query(`update account set password = $1, "updatedAt" = $2::timestamptz where id = $3`, [
      hashed,
      now,
      acc[0].id,
    ]);
  } else {
    await sql.query(
      `insert into account (
         id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
       ) values ($1, $2, 'credential', $3, $4, $5::timestamptz, $5::timestamptz)`,
      [`acc-sms-${user.user_id}`, user.user_id, user.user_id, hashed, now],
    );
  }
  await sql.query(`delete from sms_codes where id = $1`, [row.id]);
  await logSms({
    phone,
    user_id: user.user_id,
    ip,
    purpose: "reset",
    event: "password_set",
    detail: "",
  });
  return { ok: true as const };
}

export async function findUserIdByPhone(phone: string) {
  const sql = await getSql();
  const rows = await sql.query<{ user_id: string }>(
    `select user_id from profiles where phone = $1 limit 1`,
    [normalizePhone(phone)],
  );
  return rows[0]?.user_id ?? null;
}

export async function markPhoneVerified(userId: string, phone: string) {
  const sql = await getSql();
  await assertPhoneFree(phone, userId);
  await sql.query(
    `insert into profiles (user_id, phone, phone_verified_at, accepted_rules_at)
     values ($1, $2, now(), now())
     on conflict (user_id) do update set
       phone = excluded.phone,
       phone_verified_at = now()`,
    [userId, normalizePhone(phone)],
  );
}

export async function noteLookupMiss(phone: string, purpose: SmsPurpose) {
  await ensureSmsTables();
  const normalized = normalizePhone(phone);
  const ip = clientIp();
  await assertSendLimits(normalized, ip, purpose, null);
  await logSms({
    phone: normalized,
    ip,
    purpose,
    event: "lookup_miss",
    detail: "",
  });
}

export { CODE_TTL_MS, COOLDOWN_MS, LOCK_MS, TICKET_TTL_MS, toE164, logSms };
