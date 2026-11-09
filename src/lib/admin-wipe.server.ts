import "@tanstack/react-start/server-only";
import { getSql } from "@/lib/db";
import { ADMIN_EMAIL, ADMIN_USER_ID, ensureAdminTables } from "@/lib/admin.server";

/** Run a statement, ignoring "table/column does not exist" (optional features). */
async function run(text: string, params: unknown[] = []) {
  const sql = await getSql();
  try {
    return await sql.query(text, params);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "42P01" || code === "42703") return [];
    throw err;
  }
}

/** Ids of every admin account (kept by the wipe). */
export async function adminIds(): Promise<string[]> {
  await ensureAdminTables();
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `select u.id from "user" u left join profiles p on p.user_id = u.id
     where u.id = $1 or p.role = 'admin' or lower(u.email) = $2`,
    [ADMIN_USER_ID, ADMIN_EMAIL],
  );
  return [...new Set([ADMIN_USER_ID, ...rows.map((r) => r.id)])];
}

export async function wipePreview() {
  const keep = await adminIds();
  const sql = await getSql();
  const count = async (q: string) => Number((await sql.query<{ n: number }>(q, [keep]))[0]?.n ?? 0);
  return {
    users: await count(`select count(*)::int as n from "user" where not (id = any($1))`),
    jobs: await count(`select count(*)::int as n from jobs where not (user_id = any($1))`),
    applications: await count(`select count(*)::int as n from applications where not (user_id = any($1))`),
    ratings: await count(
      `select count(*)::int as n from ratings where not (from_user_id = any($1)) or not (to_user_id = any($1))`,
    ),
    admins: keep.length,
  };
}

/**
 * Everything worth keeping as a backup before the wipe — no password hashes,
 * sessions or profile photos.
 */
export async function wipeBackup() {
  const q = async (text: string) => (await run(text)) as Record<string, unknown>[];
  return {
    exportedAt: new Date().toISOString(),
    users: await q(`select id, name, email, "emailVerified", "createdAt" from "user" order by "createdAt"`),
    profiles: await q(
      `select user_id, first_name, last_name, phone, phone_verified_at, accepted_rules_at, bio, role,
              banned_at, banned_until, ban_reason
       from profiles`,
    ),
    jobs: await q(`select * from jobs order by id`),
    applications: await q(`select * from applications order by id`),
    ratings: await q(`select * from ratings order by id`),
    reports: await q(`select * from reports order by id`),
    supportMessages: await q(`select * from support_messages order by id`),
    note: "Rabotaem.md backup before deleting all non-admin accounts",
  };
}

/**
 * Delete every account except the admin(s), with all their data: profiles,
 * logins, sessions, listings (and everything hanging on them), applications,
 * ratings, favorites, notifications, SMS data, reports and messages.
 */
export async function wipeAllButAdmin() {
  const keep = await adminIds();
  const not = (col: string) => `not (${col} = any($1))`;

  // Listings by non-admins (applications, favorites, ratings, reminders, boosts cascade).
  await run(`delete from jobs where ${not("user_id")}`, [keep]);
  await run(`delete from applications where ${not("user_id")}`, [keep]);
  await run(`delete from ratings where ${not("from_user_id")} or ${not("to_user_id")}`, [keep]);

  for (const [table, column] of [
    ["favorites", "user_id"],
    ["blocks", "blocker_id"],
    ["blocks", "blocked_id"],
    ["job_reminders", "user_id"],
    ["push_devices", "user_id"],
    ["invites", "inviter_id"],
    ["subscriptions", "user_id"],
    ["job_boosts", "user_id"],
    ["phone_verifications", "user_id"],
    ["user_warnings", "user_id"],
    ["admin_messages", "user_id"],
    ["reports", "reporter_id"],
    ["support_messages", "user_id"],
    ["rating_skips", "from_user_id"],
    ["rating_skips", "to_user_id"],
    ["rating_prompts", "user_id"],
    ["rating_prompts", "to_user_id"],
  ] as const) {
    await run(`delete from ${table} where ${not(column)}`, [keep]);
  }
  // Reports about deleted users or deleted listings.
  await run(`delete from reports where target_type = 'user' and ${not("target_id")}`, [keep]);
  await run(
    `delete from reports where target_type = 'job' and not exists (select 1 from jobs j where j.id::text = reports.target_id)`,
  );
  // Short-lived security data: start clean.
  await run(`delete from sms_codes`);
  await run(`delete from sms_log`);
  await run(`delete from rate_limits`);
  await run(`delete from "verification"`);

  await run(`delete from profiles where ${not("user_id")}`, [keep]);
  // Finally the identities (sessions and login accounts cascade).
  const deleted = await run(`delete from "user" where ${not("id")} returning id`, [keep]);
  return { deletedUsers: deleted.length };
}
