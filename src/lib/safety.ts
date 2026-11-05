import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export function normalizePhone(phone: string) {
  let n = phone.replace(/[^\d+]/g, "").replace(/^00/, "+").trim();
  if (n.startsWith("+373")) n = `0${n.slice(4)}`;
  else if (n.startsWith("373") && n.length >= 11) n = `0${n.slice(3)}`;
  return n;
}

export async function ensureSafetyTables() {
  const sql = await getSql();
  await sql.query("alter table jobs add column if not exists views_count integer not null default 0");
  await sql.query(`
    create table if not exists profiles (
      user_id text primary key,
      first_name text not null default '',
      last_name text not null default '',
      phone text not null default '',
      accepted_rules_at timestamptz not null default now(),
      photo_data text
    )
  `);
  try {
    await sql.query(`
      create unique index if not exists profiles_phone_unique
      on profiles (phone)
      where phone <> ''
    `);
  } catch (err) {
    console.error("[safety] unique phone index", err);
  }
  await sql.query(`
    create table if not exists blocks (
      blocker_id text not null,
      blocked_id text not null,
      created_at timestamptz not null default now(),
      primary key (blocker_id, blocked_id)
    )
  `);
  await sql.query(`
    create table if not exists support_messages (
      id serial primary key,
      user_id text,
      name text not null,
      email text not null,
      message text not null,
      created_at timestamptz not null default now()
    )
  `);
}

export async function assertPhoneFree(phone: string, exceptUserId?: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) throw new Error("Numărul de telefon este invalid");
  await ensureSafetyTables();
  const sql = await getSql();
  const rows = await sql.query<{ user_id: string; phone: string }>(
    "select user_id, phone from profiles where phone <> ''",
  );
  const taken = rows.find((row) => {
    if (exceptUserId && row.user_id === exceptUserId) return false;
    return normalizePhone(row.phone) === normalized;
  });
  if (taken) throw new Error("Acest număr de telefon este deja folosit");
}

export const checkPhoneAvailable = createServerFn({ method: "POST" })
  .validator((phone: string) => phone)
  .handler(async ({ data: phone }) => {
    await assertPhoneFree(phone);
    return { ok: true as const };
  });

export async function blockedSetFor(userId: string) {
  await ensureSafetyTables();
  const sql = await getSql();
  const rows = await sql.query<{ other: string }>(
    `select blocked_id as other from blocks where blocker_id = $1
     union
     select blocker_id as other from blocks where blocked_id = $1`,
    [userId],
  );
  return new Set(rows.map((r) => r.other));
}

export async function assertNotBlocked(a: string, b: string) {
  const set = await blockedSetFor(a);
  if (set.has(b)) throw new Error("Nu poți interacționa cu acest utilizator");
}

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    if (userId === context.userId) throw new Error("Nu te poți bloca pe tine");
    await ensureSafetyTables();
    const sql = await getSql();
    await sql.query(
      `insert into blocks (blocker_id, blocked_id) values ($1, $2)
       on conflict do nothing`,
      [context.userId, userId],
    );
    return { ok: true as const };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    await ensureSafetyTables();
    const sql = await getSql();
    await sql.query("delete from blocks where blocker_id = $1 and blocked_id = $2", [
      context.userId,
      userId,
    ]);
    return { ok: true as const };
  });

export const listBlockedIds = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const set = await blockedSetFor(context.userId);
    return [...set];
  });

export const getBlockStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    await ensureSafetyTables();
    const sql = await getSql();
    const rows = await sql.query<{ n: number }>(
      "select count(*)::int as n from blocks where blocker_id = $1 and blocked_id = $2",
      [context.userId, userId],
    );
    return { blocked: (rows[0]?.n ?? 0) > 0 };
  });

export const submitSupport = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(120),
        message: z.string().trim().min(10).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { assertRateLimit } = await import("./rate-limit.server");
    await assertRateLimit("support", 5, 60);
    await ensureSafetyTables();
    const sql = await getSql();
    await sql.query(
      "insert into support_messages (name, email, message) values ($1, $2, $3)",
      [data.name, data.email, data.message],
    );
    return { ok: true as const };
  });
