import "@tanstack/react-start/server-only";
import { getSql } from "@/lib/db";
import { clientIp } from "@/lib/sms.server";

export async function ensureRateLimitTable() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists rate_limits (
      id serial primary key,
      ip text not null,
      action text not null,
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`create index if not exists rate_limits_ip_action_idx on rate_limits (ip, action, created_at desc)`);
}

export async function assertRateLimit(action: string, max: number, windowMinutes: number) {
  await ensureRateLimitTable();
  const ip = clientIp();
  if (!ip || ip === "unknown") return;

  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n from rate_limits
     where ip = $1 and action = $2 and created_at > now() - ($3 || ' minutes')::interval`,
    [ip, action, String(windowMinutes)],
  );
  const count = rows[0]?.n ?? 0;
  if (count >= max) {
    throw new Error(`rate.limit|${windowMinutes}`);
  }
  await sql.query(`insert into rate_limits (ip, action) values ($1, $2)`, [ip, action]);
}
