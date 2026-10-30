import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { REPORT_REASONS } from "@/lib/i18n";

export type Report = {
  id: number;
  reporter_id: string;
  target_type: "job" | "user";
  target_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
};

export async function ensureCommunityTables() {
  const sql = await getSql();
  await sql.query("alter table profiles add column if not exists photo_data text");
  await sql.query(`
    create table if not exists reports (
      id serial primary key,
      reporter_id text not null,
      target_type text not null,
      target_id text not null,
      reason text not null,
      details text not null default '',
      status text not null default 'pending',
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists favorites (
      user_id text not null,
      job_id integer not null references jobs (id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, job_id)
    )
  `);
}

export const submitReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        targetType: z.enum(["job", "user"]),
        targetId: z.string().min(1).max(80),
        reason: z.enum(REPORT_REASONS),
        details: z.string().trim().max(400).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureCommunityTables();
    if (data.targetType === "user" && data.targetId === context.userId) {
      throw new Error("Nu te poți raporta pe tine");
    }
    const sql = await getSql();
    const recent = await sql.query<{ n: number }>(
      `select count(*)::int as n from reports
       where reporter_id = $1 and target_type = $2 and target_id = $3
         and created_at > now() - interval '1 day'`,
      [context.userId, data.targetType, data.targetId],
    );
    if ((recent[0]?.n ?? 0) > 0) throw new Error("Ai raportat deja acest element");
    await sql.query(
      `insert into reports (reporter_id, target_type, target_id, reason, details)
       values ($1, $2, $3, $4, $5)`,
      [context.userId, data.targetType, data.targetId, data.reason, data.details ?? ""],
    );
    return { ok: true as const };
  });

export const listMyReports = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureCommunityTables();
    const sql = await getSql();
    return sql.query<Report>(
      `select id, reporter_id, target_type, target_id, reason, details, status, created_at
       from reports where reporter_id = $1 order by created_at desc limit 50`,
      [context.userId],
    );
  });

export const listAllReports = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    await ensureCommunityTables();
    const sql = await getSql();
    return sql.query<Report & { reporter_name: string; target_report_count: number }>(
      `select r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
              coalesce(nullif(trim(both from concat_ws(' ', p.first_name, p.last_name)), ''), r.reporter_id) as reporter_name,
              (select count(*)::int from reports r2
                where r2.target_type = r.target_type and r2.target_id = r.target_id) as target_report_count
       from reports r
       left join profiles p on p.user_id = r.reporter_id
       order by r.created_at desc
       limit 100`,
    );
  });

export const updateReportStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ id: z.number().int(), status: z.enum(["pending", "reviewed", "dismissed"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    await ensureCommunityTables();
    const sql = await getSql();
    await sql.query("update reports set status = $1 where id = $2", [data.status, data.id]);
    return { ok: true as const };
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    await ensureCommunityTables();
    const sql = await getSql();
    const existing = await sql.query<{ job_id: number }>(
      "select job_id from favorites where user_id = $1 and job_id = $2",
      [context.userId, jobId],
    );
    if (existing[0]) {
      await sql.query("delete from favorites where user_id = $1 and job_id = $2", [
        context.userId,
        jobId,
      ]);
      return { saved: false as const };
    }
    await sql.query("insert into favorites (user_id, job_id) values ($1, $2)", [
      context.userId,
      jobId,
    ]);
    return { saved: true as const };
  });

export const listFavoriteIds = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureCommunityTables();
    const sql = await getSql();
    const rows = await sql.query<{ job_id: number }>(
      "select job_id from favorites where user_id = $1",
      [context.userId],
    );
    return rows.map((r) => r.job_id);
  });
