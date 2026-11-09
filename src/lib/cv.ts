import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { cvDataSchema, normalizeCv, type CvData } from "@/lib/cv-shared";

export const CV_FILE_MAX = 5 * 1024 * 1024;
export const CV_FILE_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "image/jpeg": "Foto",
  "image/png": "Foto",
  "image/webp": "Foto",
};

export type MyCv = { data: CvData; photo: string | null; updated_at: string } | null;
export type CvFileMeta = { id: number; name: string; mime: string; size: number; created_at: string };

export const getMyCv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MyCv> => {
    const sql = await getSql();
    const rows = await sql.query<{ data: unknown; photo: string | null; updated_at: string }>(
      `select data, photo, updated_at from cvs where user_id = $1`,
      [context.userId],
    );
    const r = rows[0];
    return r ? { data: normalizeCv(r.data), photo: r.photo, updated_at: r.updated_at } : null;
  });

export const saveMyCv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        data: cvDataSchema,
        photo: z.string().max(180_000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.photo && !/^data:image\/(png|jpe?g|webp);base64,/i.test(data.photo)) {
      throw new Error("Poza nu este validă");
    }
    const sql = await getSql();
    await sql.query(
      `insert into cvs (user_id, data, photo, updated_at) values ($1, $2::jsonb, $3, now())
       on conflict (user_id) do update set data = excluded.data, photo = excluded.photo, updated_at = now()`,
      [context.userId, JSON.stringify(data.data), data.photo ?? null],
    );
    return { ok: true as const };
  });

export const listMyCvFiles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql.query<CvFileMeta>(
      `select id, name, mime, size, created_at from cv_files where user_id = $1 order by created_at desc`,
      [context.userId],
    );
  });

export const uploadCvFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(140),
        mime: z.string().max(120),
        b64: z.string().max(Math.ceil((CV_FILE_MAX * 4) / 3) + 16),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!CV_FILE_TYPES[data.mime]) throw new Error("cv.errType");
    const bytes = Buffer.from(data.b64, "base64");
    if (bytes.length === 0) throw new Error("cv.errEmpty");
    if (bytes.length > CV_FILE_MAX) throw new Error("cv.errSize");
    const { assertRateLimit } = await import("./rate-limit.server");
    await assertRateLimit("cv_upload", 20, 60);
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `insert into cv_files (user_id, name, mime, size, data) values ($1, $2, $3, $4, $5) returning id`,
      [context.userId, data.name.replace(/[\r\n"]/g, " "), data.mime, bytes.length, bytes],
    );
    // Keep at most 5 files that are not attached to an application.
    await sql.query(
      `delete from cv_files where user_id = $1 and id in (
         select f.id from cv_files f
         where f.user_id = $1 and not exists (select 1 from applications a where a.cv_file_id = f.id)
         order by f.created_at desc offset 5
       )`,
      [context.userId],
    );
    return { id: rows[0].id };
  });

export const deleteCvFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const used = await sql.query<{ n: number }>(
      `select count(*)::int as n from applications a join jobs j on j.id = a.job_id
       where a.cv_file_id = $1 and a.status in ('pending','contacted','interview','selected')
         and j.status not in ('cancelled','completed')`,
      [data.id],
    );
    if ((used[0]?.n ?? 0) > 0) throw new Error("cv.errInUse");
    await sql.query(`update applications set cv_file_id = null where cv_file_id = $1 and user_id = $2`, [
      data.id,
      context.userId,
    ]);
    await sql.query(`delete from cv_files where id = $1 and user_id = $2`, [data.id, context.userId]);
    return { ok: true as const };
  });

/** The file itself: for its owner, or for an employer it was sent to. */
export const getCvFile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ name: string; mime: string; data: Buffer | Uint8Array; user_id: string }>(
      `select f.name, f.mime, f.data, f.user_id from cv_files f
       where f.id = $1 and (
         f.user_id = $2 or exists (
           select 1 from applications a join jobs j on j.id = a.job_id
           where a.cv_file_id = f.id and j.user_id = $2
         )
       )`,
      [data.id, context.userId],
    );
    const r = rows[0];
    if (!r) throw new Error("cv.errNotFound");
    return { name: r.name, mime: r.mime, b64: Buffer.from(r.data).toString("base64") };
  });

export type ApplicationCv = {
  applicationId: number;
  jobId: number;
  jobTitle: string;
  company: string;
  name: string;
  phone: string | null;
  email: string;
  message: string;
  status: string;
  createdAt: string;
  viewedAt: string | null;
  interviewAt: string | null;
  interviewNote: string;
  employerNote: string;
  cv: CvData | null;
  photo: string | null;
  file: { id: number; name: string; mime: string; size: number } | null;
  isEmployer: boolean;
  applicantId: string;
};

/** The CV sent with an application. Opening it as the employer marks it "seen". */
export const getApplicationCv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ applicationId: z.number().int() }).parse(d))
  .handler(async ({ context, data }): Promise<ApplicationCv> => {
    const sql = await getSql();
    const rows = await sql.query<{
      id: number;
      job_id: number;
      title: string;
      company: string;
      poster_id: string;
      user_id: string;
      name: string;
      contact_phone: string | null;
      email: string;
      message: string;
      status: string;
      created_at: string;
      viewed_at: string | null;
      interview_at: string | null;
      interview_note: string;
      employer_note: string;
      cv_snapshot: unknown;
      cv_photo: string | null;
      cv_file_id: number | null;
      file_name: string | null;
      file_mime: string | null;
      file_size: number | null;
    }>(
      `select a.id, a.job_id, j.title, coalesce(j.company, '') as company, j.user_id as poster_id, a.user_id,
              coalesce(nullif(trim(a.first_name || ' ' || a.last_name), ''), a.applicant_name) as name,
              a.contact_phone, a.email, a.message, a.status, a.created_at, a.viewed_at,
              a.interview_at, a.interview_note, a.employer_note, a.cv_snapshot, a.cv_photo, a.cv_file_id,
              f.name as file_name, f.mime as file_mime, f.size as file_size
       from applications a
       join jobs j on j.id = a.job_id
       left join cv_files f on f.id = a.cv_file_id
       where a.id = $1`,
      [data.applicationId],
    );
    const r = rows[0];
    if (!r || (r.poster_id !== context.userId && r.user_id !== context.userId)) throw new Error("cv.errNotFound");
    const isEmployer = r.poster_id === context.userId;
    let viewedAt = r.viewed_at;
    if (isEmployer && !viewedAt) {
      const upd = await sql.query<{ viewed_at: string }>(
        `update applications set viewed_at = now() where id = $1 returning viewed_at`,
        [r.id],
      );
      viewedAt = upd[0]?.viewed_at ?? null;
    }
    return {
      applicationId: r.id,
      jobId: r.job_id,
      jobTitle: r.title,
      company: r.company,
      name: r.name,
      phone: r.status === "withdrawn" ? null : r.contact_phone,
      email: r.email,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      viewedAt,
      interviewAt: r.interview_at,
      interviewNote: r.interview_note,
      employerNote: isEmployer ? r.employer_note : "",
      cv: r.cv_snapshot ? normalizeCv(r.cv_snapshot) : null,
      photo: r.cv_photo,
      file: r.cv_file_id && r.file_name ? { id: r.cv_file_id, name: r.file_name, mime: r.file_mime ?? "", size: r.file_size ?? 0 } : null,
      isEmployer,
      applicantId: r.user_id,
    };
  });

/** Employer marks an application as seen (opening the candidate sheet). */
export const markApplicationViewed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ applicationId: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql.query(
      `update applications a set viewed_at = now()
       from jobs j
       where a.id = $1 and j.id = a.job_id and j.user_id = $2 and a.viewed_at is null`,
      [data.applicationId, context.userId],
    );
    return { ok: true as const };
  });

export const saveEmployerNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ applicationId: z.number().int(), note: z.string().max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `update applications a set employer_note = $3
       from jobs j
       where a.id = $1 and j.id = a.job_id and j.user_id = $2
       returning a.id`,
      [data.applicationId, context.userId, data.note.trim()],
    );
    if (!rows[0]) throw new Error("cv.errNotFound");
    return { ok: true as const };
  });

/** Invite a candidate to an interview: date/time + address or note; notifies them. */
export const inviteToInterview = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        applicationId: z.number().int(),
        at: z.string().min(10).max(40),
        note: z.string().trim().max(600).default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const when = new Date(data.at);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60 * 60_000) {
      throw new Error("Data sau ora este invalidă");
    }
    const sql = await getSql();
    const rows = await sql.query<{ user_id: string; title: string; job_id: number; company: string }>(
      `update applications a set status = 'interview', interview_at = $3, interview_note = $4,
              viewed_at = coalesce(a.viewed_at, now())
       from jobs j
       where a.id = $1 and j.id = a.job_id and j.user_id = $2 and a.status <> 'withdrawn'
       returning a.user_id, j.title, j.id as job_id, coalesce(j.company, '') as company`,
      [data.applicationId, context.userId, when.toISOString(), data.note],
    );
    const r = rows[0];
    if (!r) throw new Error("cv.errNotFound");
    const whenRo = new Intl.DateTimeFormat("ro-MD", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Chisinau",
    }).format(when);
    const { notifyUser } = await import("./push.server");
    void notifyUser(
      r.user_id,
      {
        title: "Ești invitat la interviu 📅",
        body: `${r.company ? `${r.company}: ` : ""}„${r.title}”, ${whenRo}.${data.note ? ` ${data.note}` : ""}`,
        url: `/jobs/${r.job_id}`,
        telegram: true,
      },
      context.userId,
    );
    return { ok: true as const };
  });
