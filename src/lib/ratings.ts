import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { completedJobsCount, ensureProfilesTable } from "@/lib/profile";

function notifyUser(
  userId: string,
  payload: { title: string; body: string; url: string },
  except?: string,
) {
  void import("./push.server")
    .then((m) => m.notifyUser(userId, payload, except))
    .catch((err) => console.error("[push]", err));
}


export const RATINGS_CHANGED_EVENT = "rabotaem:ratings";

export function notifyRatingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RATINGS_CHANGED_EVENT));
}

export type Rating = {
  id: number;
  job_id: number;
  from_user_id: string;
  to_user_id: string;
  stars: number;
  comment: string;
  created_at: string;
};

export type PublicReview = {
  id: number;
  stars: number;
  comment: string;
  created_at: string;
  from_name: string;
  from_user_id: string;
  job_title: string;
  job_id: number;
  role: "poster" | "worker";
};

export type RatingSummary = {
  userId: string;
  displayName: string;
  average: number;
  count: number;
  reviews: PublicReview[];
  photo: string | null;
  completedCount: number;
  phone: string | null;
  bio: string;
  phoneVerified: boolean;
  breakdown: { stars: number; n: number }[];
  history: Array<{
    id: number;
    title: string;
    raion: string;
    locality: string;
    starts_at: string | null;
    payment_mdl: number;
    role: "poster" | "worker";
  }>;
  firstName: string;
  lastName: string;
};

export type PendingRating = {
  jobId: number;
  jobTitle: string;
  otherUserId: string;
  otherName: string;
  otherRole: "poster" | "worker";
};

export async function ensureRatingsTable() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists ratings (
      id serial primary key,
      job_id integer not null references jobs (id) on delete cascade,
      from_user_id text not null,
      to_user_id text not null,
      stars integer not null check (stars >= 1 and stars <= 5),
      comment text not null default '',
      created_at timestamptz not null default now(),
      unique (job_id, from_user_id, to_user_id)
    )
  `);
}

export const submitRating = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        jobId: z.number().int(),
        toUserId: z.string().min(1),
        stars: z.number().int().min(1).max(5),
        comment: z.string().trim().max(400).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureRatingsTable();
    if (data.toUserId === context.userId) throw new Error("Nu te poți evalua pe tine");
    const sql = await getSql();
    const jobs = await sql.query<{ id: number; user_id: string; status: string; title: string }>(
      "select id, user_id, status, title from jobs where id = $1",
      [data.jobId],
    );
    const job = jobs[0];
    if (!job) throw new Error("Jobul nu există");
    if (job.status !== "completed") throw new Error("Poți evalua doar după ce jobul e marcat ca finalizat");

    const isPoster = job.user_id === context.userId;
    if (isPoster) {
      const selected = await sql.query<{ user_id: string }>(
        "select user_id from applications where job_id = $1 and user_id = $2 and status = 'selected'",
        [data.jobId, data.toUserId],
      );
      if (!selected[0]) throw new Error("Poți evalua doar un muncitor selectat la acest job");
    } else {
      if (data.toUserId !== job.user_id) throw new Error("Poți evalua doar persoana care a publicat anunțul");
      const selected = await sql.query<{ user_id: string }>(
        "select user_id from applications where job_id = $1 and user_id = $2 and status = 'selected'",
        [data.jobId, context.userId],
      );
      if (!selected[0]) throw new Error("Poți evalua doar dacă ai fost selectat la acest job");
    }

    const existing = await sql.query<{ id: number }>(
      "select id from ratings where job_id = $1 and from_user_id = $2 and to_user_id = $3",
      [data.jobId, context.userId, data.toUserId],
    );
    if (existing[0]) throw new Error("Ai evaluat deja această colaborare");

    await sql.query(
      `insert into ratings (job_id, from_user_id, to_user_id, stars, comment)
       values ($1, $2, $3, $4, $5)`,
      [data.jobId, context.userId, data.toUserId, data.stars, data.comment ?? ""],
    );
    void notifyUser(
      data.toUserId,
      {
        title: "Evaluare nouă",
        body: `Ai primit ${data.stars} ${data.stars === 1 ? "stea" : "stele"} pentru „${job.title}”.`,
        url: `/u/${data.toUserId}`,
      },
      context.userId,
    );
    return { ok: true as const };
  });

export const getPublicProfile = createServerFn({ method: "GET" })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    await ensureRatingsTable();
    await ensureProfilesTable();
    const sql = await getSql();
    const nameRows = await sql.query<{
      name: string;
      photo: string | null;
      phone: string | null;
      bio: string;
      phone_verified_at: string | null;
      first_name: string;
      last_name: string;
    }>(
      `select coalesce(
         (select nullif(trim(both from concat_ws(' ', nullif(first_name, ''), nullif(last_name, ''))), '') from profiles where user_id = $1),
         (select poster_name from jobs where user_id = $1 order by created_at desc limit 1),
         (select applicant_name from applications where user_id = $1 order by created_at desc limit 1),
         'Utilizator'
       ) as name,
       (select photo_data from profiles where user_id = $1) as photo,
       (select phone from profiles where user_id = $1) as phone,
       coalesce((select bio from profiles where user_id = $1), '') as bio,
       (select phone_verified_at from profiles where user_id = $1) as phone_verified_at,
       coalesce((select first_name from profiles where user_id = $1), '') as first_name,
       coalesce((select last_name from profiles where user_id = $1), '') as last_name`,
      [userId],
    );
    const stats = await sql.query<{ average: number; count: number }>(
      `select coalesce(avg(stars)::float, 0) as average, count(*)::int as count
       from ratings where to_user_id = $1`,
      [userId],
    );
    const reviews = await sql.query<PublicReview>(
      `select r.id, r.stars, r.comment, r.created_at, r.from_user_id, r.job_id,
              coalesce(j.title, 'Job') as job_title,
              coalesce(
                nullif(trim(both from concat_ws(' ', nullif(p.first_name, ''), nullif(p.last_name, ''))), ''),
                a.applicant_name,
                (select poster_name from jobs where user_id = r.from_user_id limit 1),
                'Utilizator'
              ) as from_name,
              case when j.user_id = r.from_user_id then 'poster' else 'worker' end as role
       from ratings r
       left join jobs j on j.id = r.job_id
       left join profiles p on p.user_id = r.from_user_id
       left join applications a on a.job_id = r.job_id and a.user_id = r.from_user_id
       where r.to_user_id = $1
       order by r.created_at desc
       limit 50`,
      [userId],
    );
    const breakdownRows = await sql.query<{ stars: number; n: number }>(
      `select stars, count(*)::int as n from ratings where to_user_id = $1 group by stars`,
      [userId],
    );
    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      n: breakdownRows.find((r) => Number(r.stars) === stars)?.n ?? 0,
    }));
    const completedCount = await completedJobsCount(userId);
    const history = await sql.query<{
      id: number;
      title: string;
      raion: string;
      locality: string;
      starts_at: string | null;
      payment_mdl: number;
      role: "poster" | "worker";
    }>(
      `select * from (
         select j.id, j.title, j.raion, j.locality, j.starts_at, j.payment_mdl, 'poster'::text as role
         from jobs j
         where j.user_id = $1 and j.status = 'completed'
         union all
         select j.id, j.title, j.raion, j.locality, j.starts_at, j.payment_mdl, 'worker'::text as role
         from applications a
         join jobs j on j.id = a.job_id
         where a.user_id = $1 and a.status = 'selected' and j.status = 'completed'
       ) h
       order by starts_at desc nulls last
       limit 20`,
      [userId],
    );
    return {
      userId,
      displayName: nameRows[0]?.name || "Utilizator",
      average: Number(stats[0]?.average ?? 0),
      count: stats[0]?.count ?? 0,
      reviews,
      photo: nameRows[0]?.photo ?? null,
      completedCount,
      phone: null,
      bio: nameRows[0]?.bio ?? "",
      phoneVerified: Boolean(nameRows[0]?.phone_verified_at),
      breakdown,
      history,
      firstName: nameRows[0]?.first_name ?? "",
      lastName: nameRows[0]?.last_name ?? "",
    } satisfies RatingSummary;
  });

export const listPendingRatings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureRatingsTable();
    const sql = await getSql();
    const asPoster = await sql.query<{
      job_id: number;
      job_title: string;
      other_user_id: string;
      other_name: string;
      other_role: "worker";
    }>(
      `select j.id as job_id, j.title as job_title, a.user_id as other_user_id,
              coalesce(nullif(trim(both from concat_ws(' ', nullif(a.first_name, ''), nullif(a.last_name, ''))), ''), a.applicant_name, 'Muncitor') as other_name,
              'worker' as other_role
       from jobs j
       join applications a on a.job_id = j.id and a.status = 'selected'
       left join ratings r on r.job_id = j.id and r.from_user_id = j.user_id and r.to_user_id = a.user_id
       where j.user_id = $1 and j.status = 'completed' and r.id is null
       order by j.created_at desc`,
      [context.userId],
    );
    const asWorker = await sql.query<{
      job_id: number;
      job_title: string;
      other_user_id: string;
      other_name: string;
      other_role: "poster";
    }>(
      `select j.id as job_id, j.title as job_title, j.user_id as other_user_id,
              coalesce(j.poster_name, 'Utilizator') as other_name,
              'poster' as other_role
       from applications a
       join jobs j on j.id = a.job_id
       left join ratings r on r.job_id = j.id and r.from_user_id = a.user_id and r.to_user_id = j.user_id
       where a.user_id = $1 and a.status = 'selected' and j.status = 'completed' and r.id is null
       order by j.created_at desc`,
      [context.userId],
    );
    const map = (
      row: {
        job_id: number;
        job_title: string;
        other_user_id: string;
        other_name: string;
        other_role: "poster" | "worker";
      },
    ): PendingRating => ({
      jobId: row.job_id,
      jobTitle: row.job_title,
      otherUserId: row.other_user_id,
      otherName: row.other_name,
      otherRole: row.other_role,
    });
    return [...asPoster.map(map), ...asWorker.map(map)];
  });

export const listMyRatingsGiven = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureRatingsTable();
    const sql = await getSql();
    return sql.query<{ job_id: number; to_user_id: string; stars: number }>(
      "select job_id, to_user_id, stars from ratings where from_user_id = $1",
      [context.userId],
    );
  });
