import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { assertPhoneFree, normalizePhone } from "@/lib/safety";
import { once } from "@/lib/once";

export type Profile = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  accepted_rules_at: string;
  photo_data: string | null;
  fcm_token: string | null;
  notify_raion: string;
  notify_push: boolean;
  bio: string;
  phone_verified_at: string | null;
  notify_email: boolean;
  notify_category: string;
};

export const ensureProfilesTable = once(ensureProfilesTableImpl);

async function ensureProfilesTableImpl() {
  const sql = await getSql();
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
  await sql.query("alter table profiles add column if not exists photo_data text");
  await sql.query("alter table profiles add column if not exists fcm_token text");
  await sql.query("alter table profiles add column if not exists notify_raion text not null default ''");
  await sql.query("alter table profiles add column if not exists notify_push boolean not null default true");
  await sql.query("alter table profiles add column if not exists phone_verified_at timestamptz");
  await sql.query("alter table profiles add column if not exists bio text not null default ''");
  await sql.query("alter table profiles add column if not exists notify_email boolean not null default true");
  await sql.query("alter table profiles add column if not exists notify_category text not null default ''");
  await sql.query("alter table profiles add column if not exists invite_code text");
  await sql.query("alter table profiles add column if not exists invited_by text");
  try {
    await sql.query(`
      create unique index if not exists profiles_phone_unique
      on profiles (phone)
      where phone <> ''
    `);
  } catch (err) {
    console.error("[profile] unique phone index", err);
  }
}

const profileSchema = z.object({
  first_name: z.string().trim().min(2).max(40),
  last_name: z.string().trim().min(2).max(40),
  phone: z.string().trim().min(8).max(20),
  bio: z.string().trim().max(280).optional().default(""),
});

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ context, data }) => {
    await ensureProfilesTable();
    await assertPhoneFree(data.phone, context.userId);
    const sql = await getSql();
    const phone = normalizePhone(data.phone);
    const existing = await sql.query<{ phone: string; phone_verified_at: string | null }>(
      "select phone, phone_verified_at from profiles where user_id = $1",
      [context.userId],
    );
    const phoneChanged = !existing[0] || existing[0].phone !== phone;
    if (phoneChanged && existing[0]?.phone && existing[0].phone.replace(/\D/g, "").length >= 8) {
      throw new Error("Numărul se schimbă doar din profil, cu un nou SMS.");
    }
    await sql.query(
      `insert into profiles (user_id, first_name, last_name, phone, bio, accepted_rules_at, phone_verified_at)
       values ($1, $2, $3, $4, $5, now(), null)
       on conflict (user_id) do update set
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         phone = excluded.phone,
         bio = excluded.bio,
         accepted_rules_at = now(),
         phone_verified_at = case when ${phoneChanged ? "true" : "false"} then null else profiles.phone_verified_at end`,
      [context.userId, data.first_name, data.last_name, phone, data.bio ?? ""],
    );
    return { ok: true as const, phoneChanged };
  });

export const saveMyBio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((bio: string) => bio.trim().slice(0, 280))
  .handler(async ({ context, data: bio }) => {
    await ensureProfilesTable();
    const sql = await getSql();
    await sql.query(
      `insert into profiles (user_id, bio, accepted_rules_at)
       values ($1, $2, now())
       on conflict (user_id) do update set bio = excluded.bio`,
      [context.userId, bio],
    );
    return { ok: true as const };
  });

export const saveMyPhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ photo: z.string().max(180_000) }).parse(d))
  .handler(async ({ context, data }) => {
    await ensureProfilesTable();
    // Raster images only: an SVG data URL can carry script.
    if (data.photo && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(data.photo)) {
      throw new Error("Format de imagine invalid");
    }
    const sql = await getSql();
    await sql.query(
      `insert into profiles (user_id, photo_data, accepted_rules_at)
       values ($1, $2, now())
       on conflict (user_id) do update set photo_data = excluded.photo_data`,
      [context.userId, data.photo || null],
    );
    return { ok: true as const };
  });

export function isProfileComplete(p: { first_name: string; last_name: string; phone: string } | null | undefined) {
  if (!p) return false;
  return p.phone.trim().length >= 8 && p.first_name.trim().length >= 2 && p.last_name.trim().length >= 2;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureProfilesTable();
    const sql = await getSql();
    const rows = await sql.query<Profile>(
      `select user_id, first_name, last_name, phone, accepted_rules_at, photo_data, fcm_token,
              notify_raion, notify_push, coalesce(bio,'') as bio, phone_verified_at,
              coalesce(notify_email, true) as notify_email, coalesce(notify_category,'') as notify_category
       from profiles where user_id = $1`,
      [context.userId],
    );
    return rows[0] ?? null;
  });

export const getProfileGate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { isAdminId } = await import("./admin.server");
    if (await isAdminId(context.userId)) return { complete: true, verified: true, admin: true, phone: "" };
    await ensureProfilesTable();
    const sql = await getSql();
    const rows = await sql.query<{
      first_name: string;
      last_name: string;
      phone: string;
      phone_verified_at: string | null;
    }>(
      "select first_name, last_name, phone, phone_verified_at from profiles where user_id = $1",
      [context.userId],
    );
    const row = rows[0];
    return {
      complete: isProfileComplete(row),
      verified: Boolean(row?.phone_verified_at),
      admin: false,
      phone: row?.phone ?? "",
    };
  });

/** Blocks posting / applying until phone + name + SMS verification. */
export async function assertProfileActive(userId: string) {
  const { isAdminId } = await import("./admin.server");
  if (await isAdminId(userId)) return;
  await ensureProfilesTable();
  const sql = await getSql();
  const rows = await sql.query<{
    first_name: string;
    last_name: string;
    phone: string;
    phone_verified_at: string | null;
  }>(
    "select first_name, last_name, phone, phone_verified_at from profiles where user_id = $1",
    [userId],
  );
  if (!isProfileComplete(rows[0])) {
    throw new Error("Completează numărul de telefon și acceptă regulile pentru a activa contul.");
  }
  if (!rows[0]?.phone_verified_at) {
    throw new Error("Verifică telefonul prin SMS pentru a activa contul.");
  }
}

export const revealProfilePhone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    await ensureProfilesTable();
    if (context.userId === userId) {
      const sql = await getSql();
      const rows = await sql.query<{ phone: string }>(
        "select phone from profiles where user_id = $1",
        [userId],
      );
      return rows[0]?.phone || null;
    }
    const sql = await getSql();
    const related = await sql.query<{ n: number }>(
      `select count(*)::int as n from applications a
       join jobs j on j.id = a.job_id
       where a.status <> 'withdrawn'
         and (
           (j.user_id = $1 and a.user_id = $2) or
           (j.user_id = $2 and a.user_id = $1)
         )`,
      [context.userId, userId],
    );
    if ((related[0]?.n ?? 0) === 0) return null;
    const rows = await sql.query<{ phone: string }>(
      `select coalesce(
         nullif((select phone from profiles where user_id = $1), ''),
         (select contact_phone from jobs where user_id = $1 order by created_at desc limit 1),
         (select contact_phone from applications where user_id = $1 order by created_at desc limit 1)
       ) as phone`,
      [userId],
    );
    return rows[0]?.phone || null;
  });

export async function completedJobsCount(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select (
       (select count(*)::int from jobs where user_id = $1 and status = 'completed')
       +
       (select count(*)::int from applications a
        join jobs j on j.id = a.job_id
        where a.user_id = $1 and a.status = 'selected' and j.status = 'completed')
     ) as n`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

export const listPublicCompleted = createServerFn({ method: "POST" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const sql = await getSql();
    const posted = await sql.query<{
      id: number;
      title: string;
      category: string;
      raion: string;
      locality: string;
      starts_at: string | null;
      role: "poster";
    }>(
      `select id, title, category, raion, locality, starts_at, 'poster' as role
       from jobs where user_id = $1 and status = 'completed'
       order by created_at desc limit 12`,
      [userId],
    );
    const worked = await sql.query<{
      id: number;
      title: string;
      category: string;
      raion: string;
      locality: string;
      starts_at: string | null;
      role: "worker";
    }>(
      `select j.id, j.title, j.category, j.raion, j.locality, j.starts_at, 'worker' as role
       from applications a
       join jobs j on j.id = a.job_id
       where a.user_id = $1 and a.status = 'selected' and j.status = 'completed'
       order by j.created_at desc limit 12`,
      [userId],
    );
    return [...posted, ...worked].slice(0, 16);
  });
