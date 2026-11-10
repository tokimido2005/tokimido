import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";

/** Today's date in Chișinău, YYYY-MM-DD. */
export function chisinauDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(date);
}

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|telegrambot|whatsapp|lighthouse|headless|python|curl|wget/i;

export function isBot(ua: string) {
  return !ua || BOT_UA.test(ua);
}

/** Where a visit came from, from utm_source or the referrer's host. */
export function sourceOf(referrer: string, utm: string, ownHost: string) {
  const u = utm.trim().toLowerCase();
  if (u) {
    if (/^(fb|facebook|ig|instagram)/.test(u)) return "facebook";
    if (/^(tg|telegram)/.test(u)) return "telegram";
    if (/^viber/.test(u)) return "viber";
    if (/^google/.test(u)) return "google";
    return "other";
  }
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "direct";
  }
  if (!host || host === ownHost.replace(/^www\./, "")) return "direct";
  if (/(^|\.)google\./.test(host)) return "google";
  if (/(^|\.)(bing\.com|yandex\.|duckduckgo\.com|yahoo\.com)/.test(host)) return "search";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com)$/.test(host)) return "facebook";
  if (/(^|\.)(t\.me|telegram\.org|telegram\.me)$/.test(host)) return "telegram";
  if (/viber/.test(host)) return "viber";
  return "other";
}

/** Daily-rotating anonymous visitor id; the IP itself is never stored. */
export function visitorId(ip: string, ua: string, day: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "rabotaem";
  return createHash("sha256").update(`${day}|${ip}|${ua}|${secret}`).digest("base64url").slice(0, 22);
}

const PRIVATE = /^\/(admin|api|_serverFn|cont|aplicatii|cv|complete|verify|reset|login|alerte|firma$)/;

export async function recordView(input: {
  path: string;
  referrer: string;
  utm: string;
  internal: boolean;
  ip: string;
  ua: string;
  host: string;
}) {
  const path = input.path.split("?")[0].slice(0, 200) || "/";
  if (!path.startsWith("/") || PRIVATE.test(path)) return;
  const day = chisinauDay();
  const sql = await getSql();
  await sql.query(`insert into page_views (day, path, source, visitor) values ($1, $2, $3, $4)`, [
    day,
    path,
    input.internal ? "internal" : sourceOf(input.referrer, input.utm, input.host),
    visitorId(input.ip, input.ua, day),
  ]);
}

export async function recordSearch(input: { q: string; kind: string; results: number }) {
  const q = input.q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  if (q.length < 2) return;
  const sql = await getSql();
  await sql.query(`insert into site_searches (day, q, kind, results) values ($1, $2, $3, $4)`, [
    chisinauDay(),
    q,
    input.kind === "oficial" ? "oficial" : "rapid",
    Math.max(0, Math.min(10_000, Math.floor(input.results))),
  ]);
}
