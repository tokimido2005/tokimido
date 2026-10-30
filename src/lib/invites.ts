import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureProfilesTable } from "@/lib/profile";

export async function ensureInviteTables() {
  const sql = await getSql();
  await sql.query(`alter table profiles add column if not exists invite_code text`);
  await sql.query(`alter table profiles add column if not exists invited_by text`);
  await sql.query(`
    create table if not exists invites (
      code text primary key,
      inviter_id text not null,
      used_by text,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
}

async function mintCode() {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(4).toString("hex");
}

export const getMyInvite = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureInviteTables();
    await ensureProfilesTable();
    const sql = await getSql();
    const rows = await sql.query<{ invite_code: string | null }>(
      "select invite_code from profiles where user_id = $1",
      [context.userId],
    );
    let code = rows[0]?.invite_code ?? "";
    if (!code) {
      code = await mintCode();
      await sql.query(
        `insert into profiles (user_id, invite_code, accepted_rules_at)
         values ($1, $2, now())
         on conflict (user_id) do update set invite_code = coalesce(profiles.invite_code, excluded.invite_code)`,
        [context.userId, code],
      );
      const again = await sql.query<{ invite_code: string | null }>(
        "select invite_code from profiles where user_id = $1",
        [context.userId],
      );
      code = again[0]?.invite_code || code;
    }
    await sql.query(
      `insert into invites (code, inviter_id) values ($1, $2) on conflict (code) do nothing`,
      [code, context.userId],
    );
    const used = await sql.query<{ n: number }>(
      "select count(*)::int as n from profiles where invited_by = $1",
      [context.userId],
    );
    return { code, invited: used[0]?.n ?? 0 };
  });

export const redeemInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((code: string) => code.trim().toLowerCase().slice(0, 16))
  .handler(async ({ context, data: code }) => {
    if (!code) return { ok: false as const };
    await ensureInviteTables();
    const sql = await getSql();
    const rows = await sql.query<{ inviter_id: string; used_by: string | null }>(
      "select inviter_id, used_by from invites where code = $1",
      [code],
    );
    const row = rows[0];
    if (!row || row.inviter_id === context.userId) return { ok: false as const };
    const mine = await sql.query<{ invited_by: string | null }>(
      "select invited_by from profiles where user_id = $1",
      [context.userId],
    );
    if (mine[0]?.invited_by) return { ok: true as const };
    await sql.query(
      `insert into profiles (user_id, invited_by, accepted_rules_at)
       values ($1, $2, now())
       on conflict (user_id) do update set invited_by = coalesce(profiles.invited_by, excluded.invited_by)`,
      [context.userId, row.inviter_id],
    );
    await sql.query(
      `update invites set used_by = coalesce(used_by, $2), used_at = coalesce(used_at, now()) where code = $1`,
      [code, context.userId],
    );
    return { ok: true as const };
  });
