import webpush from "web-push";
import { getSql } from "@/lib/db";
import { FIREBASE_CONFIG } from "@/lib/firebase-config";
import { google } from "googleapis";
import { once } from "@/lib/once";

async function getAccessToken() {
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const token = await auth.getAccessToken();
  return token?.token ?? null;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  /** Also send through the Telegram bot to users who linked it (important events only). */
  telegram?: boolean;
};

type Device = {
  id: number;
  user_id: string;
  token: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export const ensurePushTables = once(ensurePushTablesImpl);

async function ensurePushTablesImpl() {
  const sql = await getSql();
  await sql.query(`alter table profiles add column if not exists fcm_token text`);
  await sql.query(`alter table profiles add column if not exists notify_raion text not null default ''`);
  await sql.query(`alter table profiles add column if not exists notify_push boolean not null default true`);
  await sql.query(`alter table jobs add column if not exists expire_notified boolean not null default false`);
  await sql.query(`
    create table if not exists push_devices (
      id serial primary key,
      user_id text not null,
      token text not null,
      endpoint text not null default '',
      p256dh text not null default '',
      auth text not null default '',
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      unique (user_id, token)
    )
  `);
  await sql.query(`create index if not exists push_devices_user_idx on push_devices (user_id)`);
  await sql.query(`
    create table if not exists push_vapid (
      id integer primary key default 1,
      public_key text not null,
      private_key text not null
    )
  `);
}

async function vapidKeys() {
  await ensurePushTables();
  const sql = await getSql();
  const rows = await sql.query<{ public_key: string; private_key: string }>(
    "select public_key, private_key from push_vapid where id = 1",
  );
  if (rows[0]) return rows[0];
  const generated = webpush.generateVAPIDKeys();
  await sql.query(
    `insert into push_vapid (id, public_key, private_key) values (1, $1, $2)
     on conflict (id) do nothing`,
    [generated.publicKey, generated.privateKey],
  );
  const again = await sql.query<{ public_key: string; private_key: string }>(
    "select public_key, private_key from push_vapid where id = 1",
  );
  return again[0] ?? { public_key: generated.publicKey, private_key: generated.privateKey };
}

export async function publicPushKey() {
  const keys = await vapidKeys();
  return keys.public_key;
}

async function devicesFor(userIds: string[]): Promise<Device[]> {
  if (userIds.length === 0) return [];
  await ensurePushTables();
  const sql = await getSql();
  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(",");
  return sql.query<Device>(
    `select d.id, d.user_id, d.token, d.endpoint, d.p256dh, d.auth
     from push_devices d
     join profiles p on p.user_id = d.user_id
     where d.user_id in (${placeholders})
       and coalesce(p.notify_push, true) = true`,
    userIds,
  );
}

async function dropDevice(id: number) {
  const sql = await getSql();
  await sql.query("delete from push_devices where id = $1", [id]);
}

function isFcmToken(token: string) {
  return Boolean(token) && !token.startsWith("http") && token.includes(":") && token.length > 40;
}

function publicOrigin() {
  const host = (
    typeof process !== "undefined"
      ? process.env.VITE_PUBLIC_HOSTNAME || process.env.PUBLIC_HOSTNAME
      : undefined
  )?.trim();
  if (!host) return "";
  if (/^https?:\/\//i.test(host)) return host.replace(/\/$/, "");
  return `https://${host.replace(/\/$/, "")}`;
}

function fcmLink(url: string) {
  const origin = publicOrigin();
  if (!origin) return url || "/";
  try {
    return new URL(url || "/", `${origin}/`).href;
  } catch {
    return `${origin}/`;
  }
}

async function sendFcmHttp(token: string, payload: PushPayload) {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;
  const body = {
    message: {
      token,
      notification: { title: payload.title, body: payload.body },
      webpush: {
        fcm_options: { link: fcmLink(payload.url) },
        notification: { icon: "/icon-192.png" },
      },
      data: { url: payload.url, title: payload.title, body: payload.body },
    },
  };
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    return res.ok;
  } catch (err) {
    console.error("[push] fcm", err);
    return false;
  }
}

async function sendOne(device: Device, payload: PushPayload) {
  const body = JSON.stringify(payload);
  const endpoint = device.endpoint || device.token;
  const canWebPush = Boolean(device.p256dh && device.auth && endpoint.startsWith("http"));
  if (canWebPush) {
    const keys = await vapidKeys();
    webpush.setVapidDetails("mailto:support@rabotaem.md", keys.public_key, keys.private_key);
    try {
      await webpush.sendNotification(
        { endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        body,
        { TTL: 60 * 60 * 12, urgency: "high" },
      );
      return;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await dropDevice(device.id);
        return;
      }
      console.error("[push] send", status ?? err);
    }
  }
  if (isFcmToken(device.token)) {
    await sendFcmHttp(device.token, payload);
  }
}

export async function notifyUsers(userIds: string[], payload: PushPayload, except?: string) {
  const unique = [...new Set(userIds.filter((id) => id && id !== except))];
  if (unique.length === 0) return;
  if (payload.telegram) {
    void import("./telegram.server").then((m) => m.notifyTelegram(unique, payload)).catch(() => {});
  }
  try {
    const devices = await devicesFor(unique);
    await Promise.all(devices.map((device) => sendOne(device, payload)));
  } catch (err) {
    console.error("[push] notifyUsers", err);
  }
}

export function notifyUser(userId: string, payload: PushPayload, except?: string) {
  return notifyUsers([userId], payload, except);
}

