import "@tanstack/react-start/server-only";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { ADMIN_EMAIL, ADMIN_USERNAME } from "@/lib/admin-public";

export { ADMIN_EMAIL, ADMIN_USERNAME };
export const ADMIN_USER_ID = "admin-tokimido";
/**
 * The admin password comes ONLY from the environment (never commit it).
 * - ADMIN_PASSWORD: used when the admin credential is first created.
 * - Changing ADMIN_PASSWORD in the host's environment applies the new value
 *   on the next restart (no extra flag needed).
 * - ADMIN_PASSWORD_RESET=1: force re-applying the same value on every boot.
 * Without ADMIN_PASSWORD no password credential is created (dev gets a random
 * one printed to the server log).
 */
function adminPasswordFromEnv(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  if (value && value.length >= 12) return value;
  if (value) console.error("[admin] ADMIN_PASSWORD must be at least 12 characters — ignored");
  return null;
}

/** Keyed (HMAC) fingerprint so the stored value reveals nothing about the password. */
async function passwordFingerprint(plain: string) {
  const { createHmac } = await import("node:crypto");
  const key = process.env.BETTER_AUTH_SECRET?.trim() || "admin-fp";
  return createHmac("sha256", key).update(`admin-password:${plain}`).digest("hex");
}

function shouldResetAdminPassword() {
  return process.env.ADMIN_PASSWORD_RESET?.trim() === "1";
}

async function resolveAdminPassword(): Promise<string | null> {
  const fromEnv = adminPasswordFromEnv();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    console.error("[admin] ADMIN_PASSWORD is not set — admin password login is disabled");
    return null;
  }
  const { randomBytes } = await import("node:crypto");
  const generated = randomBytes(12).toString("base64url");
  console.warn(`[admin] dev admin password (set ADMIN_PASSWORD to choose one): ${generated}`);
  return generated;
}

// Schema patch runs once per process, not on every admin/ban check.
let adminTablesReady: Promise<void> | null = null;

export function ensureAdminTables(): Promise<void> {
  adminTablesReady ??= createAdminTables().catch((err) => {
    adminTablesReady = null;
    throw err;
  });
  return adminTablesReady;
}

async function createAdminTables() {
  const sql = await getSql();
  await sql.query(`alter table profiles add column if not exists role text not null default 'user'`);
  await sql.query(`alter table profiles add column if not exists banned_at timestamptz`);
  await sql.query(`alter table profiles add column if not exists banned_until timestamptz`);
  await sql.query(`alter table profiles add column if not exists ban_reason text not null default ''`);
  await sql.query(`alter table jobs add column if not exists hidden boolean not null default false`);
  await sql.query(`alter table jobs add column if not exists is_demo boolean not null default false`);
  await sql.query(`
    create table if not exists admin_actions (
      id serial primary key,
      admin_id text not null,
      action text not null,
      target_type text not null default '',
      target_id text not null default '',
      details text not null default '',
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists admin_messages (
      id serial primary key,
      admin_id text not null,
      user_id text not null,
      title text not null,
      body text not null,
      read_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`create index if not exists admin_actions_created_idx on admin_actions (created_at desc)`);
  await sql.query(`create index if not exists admin_messages_user_idx on admin_messages (user_id, created_at desc)`);
}

let seeded = false;

export async function ensureAdminUser() {
  await ensureAdminTables();
  if (seeded) return;
  const sql = await getSql();
  const existing = await sql.query<{ id: string }>(
    `select id from "user" where id = $1 or lower(email) = $2 limit 1`,
    [ADMIN_USER_ID, ADMIN_EMAIL],
  );
  const userId = existing[0]?.id ?? ADMIN_USER_ID;
  const now = new Date().toISOString();
  if (!existing[0]) {
    await sql.query(
      `insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
       values ($1, $2, $3, true, null, $4::timestamptz, $4::timestamptz)`,
      [ADMIN_USER_ID, "Tokimido", ADMIN_EMAIL, now],
    );
  }
  const acc = await sql.query<{ id: string }>(
    `select id from account where "userId" = $1 and "providerId" = 'credential'`,
    [userId],
  );
  if (!acc[0]) {
    const plain = await resolveAdminPassword();
    if (plain) {
      await sql.query(
        `insert into account (
           id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt"
         ) values ($1, $2, 'credential', $3, $4, $5::timestamptz, $5::timestamptz)`,
        [`acc-${userId}`, userId, userId, await hashPassword(plain), now],
      );
      await sql.query(
        `create table if not exists admin_meta (key text primary key, value text not null default '', created_at timestamptz not null default now())`,
      );
      await sql.query(
        `insert into admin_meta (key, value) values ('password_env_fp', $1)
         on conflict (key) do update set value = excluded.value, created_at = now()`,
        [await passwordFingerprint(plain)],
      );
    }
  } else {
    // ADMIN_PASSWORD in the environment is the source of truth: whenever its
    // value changes (or on the first boot after the leaked password), the
    // stored credential is replaced and admin sessions are signed out. A
    // keyed fingerprint of the last applied value is kept so an unchanged
    // value is not re-applied on every restart.
    await sql.query(
      `create table if not exists admin_meta (key text primary key, value text not null default '', created_at timestamptz not null default now())`,
    );
    const meta = await sql.query<{ key: string; value: string }>(
      `select key, value from admin_meta where key in ('password_rotated_v2', 'password_env_fp')`,
    );
    const firstRotation = !meta.some((m) => m.key === "password_rotated_v2");
    const appliedFp = meta.find((m) => m.key === "password_env_fp")?.value ?? "";
    const plain = adminPasswordFromEnv();
    const fp = plain ? await passwordFingerprint(plain) : "";
    const envChanged = Boolean(plain) && fp !== appliedFp;
    if (plain && (firstRotation || envChanged || shouldResetAdminPassword())) {
      await sql.query(
        `update account set password = $1, "updatedAt" = $2::timestamptz where id = $3`,
        [await hashPassword(plain), now, acc[0].id],
      );
      await sql.query(`delete from "session" where "userId" = $1`, [userId]);
      await sql.query(
        `insert into admin_meta (key, value) values ('password_env_fp', $1)
         on conflict (key) do update set value = excluded.value, created_at = now()`,
        [fp],
      );
      await sql.query(
        `insert into admin_meta (key, value) values ('password_rotated_v2', $1) on conflict (key) do nothing`,
        [now],
      );
      console.warn("[admin] admin password set from ADMIN_PASSWORD");
    } else if (!plain && firstRotation && process.env.NODE_ENV === "production") {
      // No new password configured: disable the leaked one rather than keep it.
      await sql.query(`delete from account where id = $1`, [acc[0].id]);
      await sql.query(`delete from "session" where "userId" = $1`, [userId]);
      await sql.query(
        `insert into admin_meta (key, value) values ('password_rotated_v2', $1) on conflict (key) do nothing`,
        [now],
      );
      console.error("[admin] leaked admin password removed — set ADMIN_PASSWORD and restart to log in");
    }
  }
  await sql.query(
    `insert into profiles (user_id, first_name, last_name, phone, accepted_rules_at, role)
     values ($1, 'Tokimido', 'Official', '', now(), 'admin')
     on conflict (user_id) do update set role = 'admin'`,
    [userId],
  );
  seeded = true;
}

export async function isAdminId(userId: string) {
  await ensureAdminUser();
  if (userId === ADMIN_USER_ID) return true;
  const sql = await getSql();
  const rows = await sql.query<{ role: string; email: string | null }>(
    `select p.role, u.email
     from profiles p
     left join "user" u on u.id = p.user_id
     where p.user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) {
    const users = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [userId]);
    return users[0]?.email?.toLowerCase() === ADMIN_EMAIL;
  }
  return row.role === "admin" || row.email?.toLowerCase() === ADMIN_EMAIL;
}

export async function assertAdmin(userId: string) {
  if (!(await isAdminId(userId))) throw new Error("Acces interzis");
}

export async function requireAdmin(userId: string) {
  await ensureAdminUser();
  await assertAdmin(userId);
}

export async function assertNotBanned(userId: string) {
  await ensureAdminTables();
  const sql = await getSql();
  const rows = await sql.query<{ banned_at: string | null; banned_until: string | null; ban_reason: string }>(
    `select banned_at, banned_until, ban_reason from profiles where user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row?.banned_at) return;
  if (row.banned_until && new Date(row.banned_until).getTime() <= Date.now()) {
    await sql.query(
      `update profiles set banned_at = null, banned_until = null, ban_reason = '' where user_id = $1`,
      [userId],
    );
    return;
  }
  const reason = row.ban_reason?.trim();
  throw new Error(reason ? `Contul este blocat: ${reason}` : "Contul tău este blocat");
}

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  details = "",
) {
  await ensureAdminTables();
  const sql = await getSql();
  await sql.query(
    `insert into admin_actions (admin_id, action, target_type, target_id, details)
     values ($1, $2, $3, $4, $5)`,
    [adminId, action, targetType, targetId, details],
  );
}
