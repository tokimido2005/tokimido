import "@tanstack/react-start/server-only";
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { normalizePhone } from "@/lib/safety";

/**
 * Telegram bot for free phone verification.
 *
 * Flow: the site creates a one-time token → the user opens
 * t.me/<bot>?start=<token> → the bot asks for the phone with Telegram's
 * "share contact" button → Telegram sends us the account's own number
 * (already verified by Telegram) → we compare it with the number on the site.
 */

const TOKEN_TTL_MINUTES = 10;

export function botToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

export function telegramEnabled() {
  return /^\d+:[\w-]{20,}$/.test(botToken());
}

function apiBase() {
  return (process.env.TELEGRAM_API_BASE?.trim() || "https://api.telegram.org").replace(/\/$/, "");
}

/** Secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token; derived from the bot token. */
export function webhookSecret() {
  return createHash("sha256").update(`rabotaem-tg-webhook:${botToken()}`).digest("hex").slice(0, 48);
}

function siteUrl() {
  return (process.env.BETTER_AUTH_URL?.trim() || "https://rabotaem.md").replace(/\/$/, "");
}

export async function tgApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  if (!telegramEnabled()) return null;
  try {
    const res = await fetch(`${apiBase()}/bot${botToken()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!data.ok) {
      console.error(`[telegram] ${method} failed: ${data.description ?? res.status}`);
      return null;
    }
    return data.result ?? null;
  } catch (err) {
    console.error(`[telegram] ${method} error`, err);
    return null;
  }
}

let tablesReady: Promise<void> | null = null;
export function ensureTelegramTables(): Promise<void> {
  tablesReady ??= (async () => {
    const sql = await getSql();
    await sql.query(`
      create table if not exists telegram_verify_tokens (
        token text primary key,
        user_id text not null,
        purpose text not null default 'verify',
        target_phone text not null default '',
        status text not null default 'pending',
        chat_id bigint,
        tg_user_id bigint,
        tg_phone text not null default '',
        created_at timestamptz not null default now(),
        expires_at timestamptz not null
      )`);
    await sql.query(`
      create table if not exists telegram_links (
        user_id text primary key,
        chat_id bigint not null unique,
        tg_user_id bigint not null,
        username text not null default '',
        phone text not null default '',
        linked_at timestamptz not null default now()
      )`);
  })().catch((err) => {
    tablesReady = null;
    throw err;
  });
  return tablesReady;
}

let usernameCache: string | null = null;
export async function botUsername(): Promise<string> {
  if (usernameCache) return usernameCache;
  const me = await tgApi<{ username?: string }>("getMe", {});
  usernameCache = me?.username || process.env.TELEGRAM_BOT_USERNAME?.trim() || "RabotaemMdBot";
  return usernameCache;
}

let webhookChecked = false;
/** Point the bot's webhook at this site (once per process; idempotent). */
export async function ensureWebhook() {
  if (webhookChecked || !telegramEnabled()) return;
  const url = `${siteUrl()}/api/telegram/webhook`;
  const info = await tgApi<{ url?: string }>("getWebhookInfo", {});
  if (info?.url !== url) {
    const ok = await tgApi("setWebhook", {
      url,
      secret_token: webhookSecret(),
      allowed_updates: ["message"],
      drop_pending_updates: false,
    });
    if (ok === null) return; // retry on the next request
    console.warn(`[telegram] webhook set to ${url}`);
  }
  webhookChecked = true;
}

export async function createVerifyToken(userId: string, purpose: "verify" | "change", targetPhone: string) {
  await ensureTelegramTables();
  const sql = await getSql();
  const token = randomBytes(18).toString("base64url"); // 24 chars, allowed in /start
  await sql.query(
    `insert into telegram_verify_tokens (token, user_id, purpose, target_phone, expires_at)
     values ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
    [token, userId, purpose, normalizePhone(targetPhone), TOKEN_TTL_MINUTES],
  );
  return token;
}

export type VerifyStatus = "pending" | "done" | "mismatch" | "foreign" | "taken" | "expired" | "missing";

export async function tokenStatus(userId: string, token: string) {
  await ensureTelegramTables();
  const sql = await getSql();
  const rows = await sql.query<{ status: string; tg_phone: string; target_phone: string; expired: boolean }>(
    `select status, tg_phone, target_phone, expires_at < now() as expired
     from telegram_verify_tokens where token = $1 and user_id = $2`,
    [token, userId],
  );
  const row = rows[0];
  if (!row) return { status: "missing" as VerifyStatus, tgPhone: "", targetPhone: "" };
  const status = (row.status === "pending" && row.expired ? "expired" : row.status) as VerifyStatus;
  return { status, tgPhone: row.tg_phone, targetPhone: row.target_phone };
}

async function setTokenStatus(token: string, status: VerifyStatus, tgPhone = "") {
  const sql = await getSql();
  await sql.query(`update telegram_verify_tokens set status = $2, tg_phone = $3 where token = $1`, [
    token,
    status,
    tgPhone,
  ]);
}

async function linkChat(userId: string, chatId: number, tgUserId: number, username: string, phone: string) {
  const sql = await getSql();
  // A chat belongs to one site account: move it if it was linked elsewhere.
  await sql.query(`delete from telegram_links where chat_id = $1 and user_id <> $2`, [chatId, userId]);
  await sql.query(
    `insert into telegram_links (user_id, chat_id, tg_user_id, username, phone)
     values ($1, $2, $3, $4, $5)
     on conflict (user_id) do update set chat_id = excluded.chat_id, tg_user_id = excluded.tg_user_id,
       username = excluded.username, phone = excluded.phone, linked_at = now()`,
    [userId, chatId, tgUserId, username, phone],
  );
}

async function logVerification(userId: string, phone: string, purpose: string) {
  const sql = await getSql();
  try {
    await sql.query(
      `insert into sms_log (phone, user_id, ip, purpose, event, detail) values ($1, $2, 'telegram', $3, 'tg_verify', 'telegram')`,
      [phone, userId, purpose],
    );
  } catch (err) {
    console.error("[telegram] log failed", err);
  }
}

/** Mark the phone verified for the token's user (shared by the bot and "use my Telegram number"). */
export async function completeVerification(
  token: string,
  userId: string,
  phone: string,
  purpose: string,
  chat?: { chatId: number; tgUserId: number; username: string },
): Promise<"done" | "taken"> {
  const { markPhoneVerified } = await import("./sms.server");
  try {
    await markPhoneVerified(userId, phone);
  } catch {
    await setTokenStatus(token, "taken", phone);
    return "taken";
  }
  await setTokenStatus(token, "done", phone);
  if (chat) await linkChat(userId, chat.chatId, chat.tgUserId, chat.username, phone);
  await logVerification(userId, phone, purpose);
  return "done";
}

// ---- Bot side ---------------------------------------------------------------

type TgLang = "ro" | "ru" | "en";
const T: Record<string, Record<TgLang, string>> = {
  hello: {
    ro: "Salut! Sunt botul Rabotaem.md. Ca să-ți verifici telefonul, apasă „Prin Telegram” pe site.",
    ru: "Привет! Я бот Rabotaem.md. Чтобы подтвердить телефон, нажмите «Через Telegram» на сайте.",
    en: "Hi! I’m the Rabotaem.md bot. To verify your phone, tap “Via Telegram” on the website.",
  },
  ask: {
    ro: "Apasă butonul de mai jos ca să ne trimiți numărul tău de telefon din Telegram.",
    ru: "Нажмите кнопку ниже, чтобы отправить номер телефона из Telegram.",
    en: "Tap the button below to send us your Telegram phone number.",
  },
  button: { ro: "📱 Trimite numărul meu", ru: "📱 Отправить мой номер", en: "📱 Send my number" },
  expired: {
    ro: "Linkul a expirat sau a fost deja folosit. Cere unul nou pe site.",
    ru: "Ссылка устарела или уже использована. Получите новую на сайте.",
    en: "This link has expired or was already used. Get a new one on the website.",
  },
  notOwn: {
    ro: "Trimite numărul tău cu butonul de mai jos, nu contactul altcuiva.",
    ru: "Отправьте свой номер кнопкой ниже, а не чужой контакт.",
    en: "Please send your own number with the button below, not someone else’s contact.",
  },
  noRequest: {
    ro: "Nu am găsit o verificare în curs. Pornește din nou de pe site.",
    ru: "Активная проверка не найдена. Начните заново на сайте.",
    en: "No verification in progress. Start again on the website.",
  },
  done: {
    ro: "Gata ✅ Telefonul {p} e verificat. Te poți întoarce pe site.",
    ru: "Готово ✅ Телефон {p} подтверждён. Можете вернуться на сайт.",
    en: "Done ✅ Phone {p} is verified. You can go back to the website.",
  },
  mismatch: {
    ro: "Numărul tău din Telegram este {t}, iar pe site ai scris {s}. Întoarce-te pe site ca să alegi pe care îl folosești.",
    ru: "В Telegram у вас номер {t}, а на сайте указан {s}. Вернитесь на сайт, чтобы выбрать.",
    en: "Your Telegram number is {t}, but the website has {s}. Go back to the website to choose.",
  },
  foreign: {
    ro: "Acceptăm doar numere din Moldova (+373). Verifică-te prin SMS pe site.",
    ru: "Мы принимаем только номера Молдовы (+373). Подтвердите телефон по SMS на сайте.",
    en: "We only accept Moldovan numbers (+373). Please verify by SMS on the website.",
  },
  taken: {
    ro: "Acest număr este deja folosit de alt cont pe Rabotaem.md.",
    ru: "Этот номер уже используется другим аккаунтом на Rabotaem.md.",
    en: "This number is already used by another Rabotaem.md account.",
  },
};

function tr(key: string, lang: TgLang, vars: Record<string, string> = {}) {
  let s = T[key][lang];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

function langOf(code?: string): TgLang {
  if (code?.startsWith("ru")) return "ru";
  if (code?.startsWith("en")) return "en";
  return "ro";
}

function show(phone: string) {
  const n = phone.replace(/\D/g, "");
  return n.length === 9 ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : phone;
}

type TgMessage = {
  chat: { id: number; type?: string };
  from?: { id: number; username?: string; language_code?: string };
  text?: string;
  contact?: { phone_number: string; user_id?: number };
};

async function reply(chatId: number, text: string, markup?: Record<string, unknown>) {
  await tgApi("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: markup ?? { remove_keyboard: true },
  });
}

/** Handle one Telegram update (called by the webhook route). */
export async function handleUpdate(update: { message?: TgMessage }) {
  const msg = update.message;
  if (!msg?.chat || (msg.chat.type && msg.chat.type !== "private")) return;
  await ensureTelegramTables();
  const sql = await getSql();
  const lang = langOf(msg.from?.language_code);
  const chatId = msg.chat.id;

  if (msg.text?.startsWith("/start")) {
    const token = msg.text.split(/\s+/)[1]?.trim() ?? "";
    if (!token) {
      await reply(chatId, tr("hello", lang));
      return;
    }
    const rows = await sql.query<{ token: string }>(
      `update telegram_verify_tokens set chat_id = $2, tg_user_id = $3
       where token = $1 and status = 'pending' and expires_at > now()
       returning token`,
      [token, chatId, msg.from?.id ?? null],
    );
    if (!rows[0]) {
      await reply(chatId, tr("expired", lang));
      return;
    }
    await reply(chatId, tr("ask", lang), {
      keyboard: [[{ text: tr("button", lang), request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
    return;
  }

  if (msg.contact) {
    // Only the sender's own contact counts — a forwarded card is not proof.
    if (!msg.from || msg.contact.user_id !== msg.from.id) {
      await reply(chatId, tr("notOwn", lang), {
        keyboard: [[{ text: tr("button", lang), request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      });
      return;
    }
    const rows = await sql.query<{ token: string; user_id: string; purpose: string; target_phone: string }>(
      `select token, user_id, purpose, target_phone from telegram_verify_tokens
       where chat_id = $1 and status = 'pending' and expires_at > now()
       order by created_at desc limit 1`,
      [chatId],
    );
    const row = rows[0];
    if (!row) {
      await reply(chatId, tr("noRequest", lang));
      return;
    }
    const raw = msg.contact.phone_number.replace(/[^\d+]/g, "");
    const phone = normalizePhone(raw.startsWith("+") ? raw : `+${raw}`);
    if (!/^0\d{8}$/.test(phone)) {
      await setTokenStatus(row.token, "foreign", raw);
      await reply(chatId, tr("foreign", lang));
      return;
    }
    if (row.target_phone && phone !== row.target_phone) {
      await setTokenStatus(row.token, "mismatch", phone);
      await sql.query(`update telegram_verify_tokens set tg_user_id = $2 where token = $1`, [row.token, msg.from.id]);
      await reply(chatId, tr("mismatch", lang, { t: show(phone), s: show(row.target_phone) }));
      return;
    }
    const result = await completeVerification(row.token, row.user_id, phone, row.purpose, {
      chatId,
      tgUserId: msg.from.id,
      username: msg.from.username ?? "",
    });
    await reply(chatId, result === "done" ? tr("done", lang, { p: show(phone) }) : tr("taken", lang));
    return;
  }

  await reply(chatId, tr("hello", lang));
}

/** "Use my Telegram number" on the site after a mismatch. */
export async function acceptTelegramNumber(userId: string, token: string) {
  await ensureTelegramTables();
  const sql = await getSql();
  const rows = await sql.query<{ tg_phone: string; purpose: string; chat_id: string | null; tg_user_id: string | null; expired: boolean }>(
    `select tg_phone, purpose, chat_id, tg_user_id, expires_at < now() - interval '20 minutes' as expired
     from telegram_verify_tokens where token = $1 and user_id = $2 and status = 'mismatch'`,
    [token, userId],
  );
  const row = rows[0];
  if (!row || row.expired || !row.tg_phone) return "expired" as const;
  const chat =
    row.chat_id && row.tg_user_id
      ? { chatId: Number(row.chat_id), tgUserId: Number(row.tg_user_id), username: "" }
      : undefined;
  const result = await completeVerification(token, userId, row.tg_phone, row.purpose, chat);
  if (result === "done" && chat) {
    await reply(chat.chatId, tr("done", "ro", { p: show(row.tg_phone) }));
  }
  return result;
}
