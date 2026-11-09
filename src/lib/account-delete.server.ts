import "@tanstack/react-start/server-only";
import { getSql } from "@/lib/db";
import { ADMIN_USER_ID, ensureAdminTables, isAdminId } from "@/lib/admin.server";

/** Run a statement, ignoring "table does not exist" (optional features). */
async function run(text: string, params: unknown[]) {
  const sql = await getSql();
  try {
    await sql.query(text, params);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "42P01" || code === "42703") return; // undefined table / column
    throw err;
  }
}

/**
 * Remove a user and their personal data.
 *
 * Deleted: profile (name, phone, photo, bio), login accounts and sessions,
 * open/closed/cancelled job ads, applications, favorites, blocks, reminders,
 * push devices, invites, subscriptions, SMS codes/log, warnings, inbox,
 * reports they filed, support messages, ratings they received.
 *
 * Anonymized (kept so other people's history and ratings stay valid):
 * completed jobs they posted, applications on completed jobs, and ratings
 * they gave to others — the user id is replaced by a random `deleted-…` id
 * and names/phones/messages are cleared.
 *
 * Kept: moderation records about the user (reports against them, admin
 * action log) — legitimate interest in preventing abuse.
 */
export async function deleteUserData(userId: string) {
  await ensureAdminTables();
  if (userId === ADMIN_USER_ID || (await isAdminId(userId))) {
    throw new Error("account.deleteAdmin");
  }
  const sql = await getSql();
  const banned = await sql.query<{ banned_at: string | null; banned_until: string | null }>(
    `select banned_at, banned_until from profiles where user_id = $1`,
    [userId],
  );
  const ban = banned[0];
  if (ban?.banned_at && (!ban.banned_until || new Date(ban.banned_until).getTime() > Date.now())) {
    // A blocked account could otherwise delete itself and re-register with
    // the same phone. Deletion is still possible on request via Contact.
    throw new Error("account.deleteBanned");
  }

  const { randomBytes } = await import("node:crypto");
  const ghost = `deleted-${randomBytes(9).toString("hex")}`;
  const deletedName = "Utilizator șters";

  // Completed jobs posted by the user: keep (workers' ratings hang on them), anonymize.
  await run(
    `update jobs set user_id = $2, poster_name = $3, contact_phone = null, company = ''
     where user_id = $1 and status = 'completed'`,
    [userId, ghost, deletedName],
  );
  // Every other job ad goes (applications/favorites/reminders/boosts cascade).
  await run(`delete from jobs where user_id = $1`, [userId]);

  // Their applications: anonymize on completed jobs, delete the rest.
  await run(
    `update applications a
     set user_id = $2, applicant_name = $3, first_name = '', last_name = '', message = '', contact_phone = null,
         email = '', cv_snapshot = null, cv_photo = null, cv_file_id = null, employer_note = ''
     from jobs j
     where a.job_id = j.id and a.user_id = $1 and j.status = 'completed'`,
    [userId, ghost, deletedName],
  );
  await run(`delete from applications where user_id = $1`, [userId]);

  // Ratings: what others said about them goes; what they said about others stays, anonymized.
  await run(`delete from ratings where to_user_id = $1`, [userId]);
  await run(`update ratings set from_user_id = $2 where from_user_id = $1`, [userId, ghost]);

  for (const [table, column] of [
    ["favorites", "user_id"],
    ["blocks", "blocker_id"],
    ["blocks", "blocked_id"],
    ["job_reminders", "user_id"],
    ["push_devices", "user_id"],
    ["invites", "inviter_id"],
    ["subscriptions", "user_id"],
    ["job_boosts", "user_id"],
    ["sms_codes", "user_id"],
    ["sms_log", "user_id"],
    ["phone_verifications", "user_id"],
    ["user_warnings", "user_id"],
    ["admin_messages", "user_id"],
    ["reports", "reporter_id"],
    ["support_messages", "user_id"],
    ["rating_skips", "from_user_id"],
    ["rating_skips", "to_user_id"],
    ["rating_prompts", "user_id"],
    ["rating_prompts", "to_user_id"],
    ["cvs", "user_id"],
    ["cv_files", "user_id"],
    ["companies", "owner_id"],
  ] as const) {
    await run(`delete from ${table} where ${column} = $1`, [userId]);
  }
  await run(`update invites set used_by = null where used_by = $1`, [userId]);
  await run(`update profiles set invited_by = null where invited_by = $1`, [userId]);
  await run(`delete from profiles where user_id = $1`, [userId]);

  // Finally the login identity (sessions + accounts cascade).
  await run(`delete from "user" where id = $1`, [userId]);
  console.warn(`[account] user ${userId.slice(0, 6)}… deleted their account`);
}
