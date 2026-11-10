/**
 * Lightweight self-monitoring: if the server logs many errors, or the
 * database gets very slow, the admin gets a Telegram alert (the chats that
 * turned on "Alerte pe Telegram" in Admin → Rapoarte). At most one alert per
 * kind every 30 minutes. Whether the site is reachable at all is checked
 * from outside (UptimeRobot → /api/health).
 */
const WINDOW_MS = 5 * 60_000;
const COOLDOWN_MS = 30 * 60_000;
const ERROR_LIMIT = Number(process.env.MONITOR_ERROR_LIMIT ?? 20);
const SLOW_LIMIT = Number(process.env.MONITOR_SLOW_LIMIT ?? 5);
const VERY_SLOW_MS = 3000;

type Kind = "errors" | "slow";
const events: Record<Kind, number[]> = { errors: [], slow: [] };
const lastAlert: Record<Kind, number> = { errors: 0, slow: 0 };
let lastError = "";

function push(kind: Kind) {
  const now = Date.now();
  const list = events[kind];
  list.push(now);
  while (list.length && now - list[0] > WINDOW_MS) list.shift();
  const limit = kind === "errors" ? ERROR_LIMIT : SLOW_LIMIT;
  if (list.length >= limit && now - lastAlert[kind] > COOLDOWN_MS) {
    lastAlert[kind] = now;
    const text =
      kind === "errors"
        ? `⚠️ Rabotaem.md: ${list.length} erori pe server în ultimele 5 minute.\nUltima: ${lastError.slice(0, 300)}`
        : `🐢 Rabotaem.md: baza de date a răspuns foarte încet (peste 3 s) de ${list.length} ori în ultimele 5 minute.`;
    void sendAlert(text);
  }
}

/** Telegram message to the admin alert chats (no import of server-only modules). */
async function sendAlert(text: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) return;
    const base = (process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org").replace(/\/$/, "");
    const { getSql } = await import("./db");
    const sql = await getSql();
    const rows = await sql.query<{ chat_id: string }>(`select chat_id from admin_alert_chats`);
    for (const row of rows) {
      await fetch(`${base}/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: row.chat_id, text: `${text}\nhttps://rabotaem.md/admin`, disable_web_page_preview: true }),
      });
    }
  } catch {
    /* alerts must never break the site */
  }
}

export function recordQueryTime(ms: number) {
  if (ms >= VERY_SLOW_MS) push("slow");
}

let installed = false;
/** Count server errors (everything logged with console.error). */
export function installErrorMonitor() {
  if (installed || typeof window !== "undefined") return;
  installed = true;
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    original(...args);
    try {
      const first = args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : "")).filter(Boolean).join(" ");
      // Telegram failures would alert about themselves; skip them.
      if (first.includes("[telegram]")) return;
      lastError = first || "eroare necunoscută";
      push("errors");
    } catch {
      /* never break logging */
    }
  };
}
