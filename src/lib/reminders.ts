import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export async function ensureReminderTables() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists job_reminders (
      id serial primary key,
      user_id text not null,
      job_id integer not null,
      remind_at timestamptz not null,
      sent_at timestamptz,
      created_at timestamptz not null default now(),
      unique (user_id, job_id)
    )
  `);
}

export async function flushDueReminders() {
  await ensureReminderTables();
  const sql = await getSql();
  const due = await sql.query<{ id: number; user_id: string; job_id: number; title: string }>(
    `select r.id, r.user_id, r.job_id, coalesce(j.title, 'Job') as title
     from job_reminders r
     left join jobs j on j.id = r.job_id
     where r.sent_at is null and r.remind_at <= now()
     limit 40`,
  );
  if (due.length === 0) return;
  const { notifyUser } = await import("./push.server");
  for (const row of due) {
    await sql.query("update job_reminders set sent_at = now() where id = $1", [row.id]);
    void notifyUser(row.user_id, {
      title: "Reminder job",
      body: `„${row.title}” începe curând.`,
      url: `/jobs/${row.job_id}`,
    });
  }
}

export const setJobReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        jobId: z.number().int(),
        kind: z.enum(["1h", "3h", "morning"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureReminderTables();
    const sql = await getSql();
    const jobs = await sql.query<{ starts_at: string | null; title: string }>(
      "select starts_at, title from jobs where id = $1",
      [data.jobId],
    );
    const job = jobs[0];
    if (!job?.starts_at) throw new Error("Anunțul nu are dată");
    const start = new Date(job.starts_at).getTime();
    if (start <= Date.now()) throw new Error("Jobul a început deja");
    let remind = start - (data.kind === "1h" ? 3600000 : data.kind === "3h" ? 10800000 : 0);
    if (data.kind === "morning") {
      const d = new Date(job.starts_at);
      d.setHours(8, 0, 0, 0);
      remind = d.getTime();
    }
    if (remind <= Date.now()) remind = Date.now() + 60_000;
    await sql.query(
      `insert into job_reminders (user_id, job_id, remind_at)
       values ($1, $2, $3)
       on conflict (user_id, job_id) do update set remind_at = excluded.remind_at, sent_at = null`,
      [context.userId, data.jobId, new Date(remind).toISOString()],
    );
    return { ok: true as const, remindAt: new Date(remind).toISOString() };
  });

export const getMyReminder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    await ensureReminderTables();
    const sql = await getSql();
    const rows = await sql.query<{ remind_at: string; sent_at: string | null }>(
      "select remind_at, sent_at from job_reminders where user_id = $1 and job_id = $2",
      [context.userId, jobId],
    );
    return rows[0] ?? null;
  });
