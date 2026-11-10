import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { REPORT_REASONS } from "@/lib/i18n";
import { once } from "@/lib/once";

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

export const ensureCommunityTables = once(ensureCommunityTablesImpl);

async function ensureCommunityTablesImpl() {
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
    void alertAdminAboutReport(data.targetType, data.targetId, data.reason, data.details ?? "");
    return { ok: true as const };
  });

/**
 * Telegram alert to the admin for a new report. At most one message per
 * reported job/user every 6 hours, so a wave of reports is a single ping.
 */
async function alertAdminAboutReport(targetType: "job" | "user", targetId: string, reason: string, details: string) {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ total: number; recent: number }>(
      `select count(*) filter (where status = 'pending')::int as total,
              count(*) filter (where created_at > now() - interval '6 hours')::int as recent
       from reports where target_type = $1 and target_id = $2`,
      [targetType, targetId],
    );
    if ((rows[0]?.recent ?? 0) > 1) return;
    let label = targetId;
    if (targetType === "job") {
      const jobs = await sql.query<{ title: string }>(`select title from jobs where id = $1`, [Number(targetId)]);
      label = jobs[0]?.title ?? `#${targetId}`;
    } else {
      const users = await sql.query<{ name: string }>(
        `select coalesce(nullif(trim(both from concat_ws(' ', p.first_name, p.last_name)), ''), u.name, u.id) as name
         from "user" u left join profiles p on p.user_id = u.id where u.id = $1`,
        [targetId],
      );
      label = users[0]?.name ?? targetId;
    }
    const { translate } = await import("@/lib/i18n");
    const lines = [
      `🚩 ${translate("ro", "report.alertTitle")}: ${translate("ro", `report.${reason}`)}`,
      `${targetType === "job" ? translate("ro", "admin.job") : translate("ro", "admin.user")}: ${label}`,
      details ? `„${details.slice(0, 200)}”` : "",
      translate("ro", "report.alertPending", { n: rows[0]?.total ?? 1 }),
    ].filter(Boolean);
    const { sendAdminAlert } = await import("./telegram.server");
    await sendAdminAlert(lines.join("\n"), "/admin?tab=reports");
  } catch (err) {
    console.error("[report] admin alert", err);
  }
}

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
