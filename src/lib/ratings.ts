import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { completedJobsCount, ensureProfilesTable } from "@/lib/profile";
import { allowedTags, COMMENT_MAX, GOOD_TAGS, MAX_TAGS, type RatedRole } from "@/lib/rating-tags";

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
  tags: string[];
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
  /** Most frequent quick tags on visible ratings, most common first. */
  topTags: { tag: string; n: number; good: boolean }[];
};

export type PendingRating = {
  jobId: number;
  jobTitle: string;
  otherUserId: string;
  otherName: string;
  otherRole: "poster" | "worker";
  /** When the job ended (or was marked completed), ISO string. */
  endedAt: string | null;
  locality: string;
};

/** When a job counts as over: marked completed, else scheduled start + duration. */
export const JOB_END_SQL = (j = "j") =>
  `coalesce(${j}.completed_at, ${j}.starts_at + make_interval(mins => coalesce(${j}.duration_minutes, 0)), case when ${j}.status = 'completed' then ${j}.created_at end)`;

/**
 * A job can be rated when the poster marked it completed, or automatically
 * 2 hours after its scheduled end — and for 14 days after that.
 */
export const RATABLE_JOB_SQL = (j = "j") => `(
  ${j}.status <> 'cancelled'
  and (
    ${j}.status = 'completed'
    or (${j}.starts_at is not null
        and ${j}.starts_at + make_interval(mins => coalesce(${j}.duration_minutes, 0)) + interval '2 hours' <= now())
  )
  and ${JOB_END_SQL(j)} > now() - interval '14 days'
)`;

/**
 * Blind ratings: a rating becomes public once the other person has rated (or
 * said the job didn't happen) for the same job, or 7 days after it was given.
 */
export const VISIBLE_RATING_SQL = (r = "r") => `(
  ${r}.created_at <= now() - interval '7 days'
  or exists (select 1 from ratings rr where rr.job_id = ${r}.job_id and rr.from_user_id = ${r}.to_user_id and rr.to_user_id = ${r}.from_user_id)
  or exists (select 1 from rating_skips rs where rs.job_id = ${r}.job_id and rs.from_user_id = ${r}.to_user_id and rs.to_user_id = ${r}.from_user_id)
)`;

let ratingsReady: Promise<void> | null = null;

export function ensureRatingsTable(): Promise<void> {
  ratingsReady ??= createRatingsTables().catch((err) => {
    ratingsReady = null;
    throw err;
  });
  return ratingsReady;
}

async function createRatingsTables() {
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
  // Same as migrations/0017_ratings_v2.sql, for databases that predate it.
  await sql.query(`alter table ratings add column if not exists tags text[] not null default '{}'`);
  await sql.query(`alter table jobs add column if not exists completed_at timestamptz`);
  await sql.query(`
    create table if not exists rating_skips (
      id serial primary key,
      job_id integer not null references jobs (id) on delete cascade,
      from_user_id text not null,
      to_user_id text not null,
      reason text not null default 'no_show',
      created_at timestamptz not null default now(),
      unique (job_id, from_user_id, to_user_id)
    )
  `);
  await sql.query(`
    create table if not exists rating_prompts (
      user_id text not null,
      job_id integer not null references jobs (id) on delete cascade,
      to_user_id text not null,
      snoozed_until timestamptz,
      reminders_sent integer not null default 0,
      last_reminded_at timestamptz,
      primary key (user_id, job_id, to_user_id)
    )
  `);
}

type RatingTarget = { role: RatedRole; job: { id: number; user_id: string; title: string } };

/** Check that `fromUserId` may rate `toUserId` for this job right now. */
async function assertCanRate(jobId: number, fromUserId: string, toUserId: string): Promise<RatingTarget> {
  if (toUserId === fromUserId) throw new Error("Nu te poți evalua pe tine");
  const sql = await getSql();
  const jobs = await sql.query<{ id: number; user_id: string; status: string; title: string; ratable: boolean }>(
    `select j.id, j.user_id, j.status, j.title, ${RATABLE_JOB_SQL("j")} as ratable from jobs j where j.id = $1`,
    [jobId],
  );
  const job = jobs[0];
  if (!job) throw new Error("Jobul nu există");
  if (!job.ratable) throw new Error("Poți evalua doar după ce jobul e marcat ca finalizat");
  const isPoster = job.user_id === fromUserId;
  if (isPoster) {
    const selected = await sql.query<{ user_id: string }>(
      "select user_id from applications where job_id = $1 and user_id = $2 and status = 'selected'",
      [jobId, toUserId],
    );
    if (!selected[0]) throw new Error("Poți evalua doar un muncitor selectat la acest job");
  } else {
    if (toUserId !== job.user_id) throw new Error("Poți evalua doar persoana care a publicat anunțul");
    const selected = await sql.query<{ user_id: string }>(
      "select user_id from applications where job_id = $1 and user_id = $2 and status = 'selected'",
      [jobId, fromUserId],
    );
    if (!selected[0]) throw new Error("Poți evalua doar dacă ai fost selectat la acest job");
  }
  const done = await sql.query<{ n: number }>(
    `select (select count(*) from ratings where job_id = $1 and from_user_id = $2 and to_user_id = $3)
          + (select count(*) from rating_skips where job_id = $1 and from_user_id = $2 and to_user_id = $3) as n`,
    [jobId, fromUserId, toUserId],
  );
  if (Number(done[0]?.n ?? 0) > 0) throw new Error("Ai evaluat deja această colaborare");
  return { role: isPoster ? "worker" : "poster", job };
}

async function displayName(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ name: string }>(
    `select coalesce(
       (select nullif(trim(both from concat_ws(' ', nullif(first_name, ''), left(nullif(last_name, ''), 1) || '.')), '') from profiles where user_id = $1),
       'Utilizator') as name`,
    [userId],
  );
  return rows[0]?.name ?? "Utilizator";
}

export const submitRating = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        jobId: z.number().int(),
        toUserId: z.string().min(1),
        stars: z.number().int().min(1).max(5),
        comment: z.string().trim().max(COMMENT_MAX).optional().default(""),
        tags: z.array(z.string().max(40)).max(MAX_TAGS).optional().default([]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureRatingsTable();
    const { role, job } = await assertCanRate(data.jobId, context.userId, data.toUserId);
    const allowed = allowedTags(role);
    const tags = [...new Set(data.tags)].filter((t) => allowed.has(t));
    const sql = await getSql();
    await sql.query(
      `insert into ratings (job_id, from_user_id, to_user_id, stars, comment, tags)
       values ($1, $2, $3, $4, $5, $6)`,
      [data.jobId, context.userId, data.toUserId, data.stars, data.comment ?? "", tags],
    );
    await sql.query(`delete from rating_prompts where user_id = $1 and job_id = $2 and to_user_id = $3`, [
      context.userId,
      data.jobId,
      data.toUserId,
    ]);
    // Blind ratings: say a rating arrived, but not what it says, until both sides answered.
    const counterpart = await sql.query<{ n: number }>(
      `select (select count(*) from ratings where job_id = $1 and from_user_id = $2 and to_user_id = $3)
            + (select count(*) from rating_skips where job_id = $1 and from_user_id = $2 and to_user_id = $3) as n`,
      [data.jobId, data.toUserId, context.userId],
    );
    const fromName = await displayName(context.userId);
    if (Number(counterpart[0]?.n ?? 0) > 0) {
      for (const uid of [data.toUserId, context.userId]) {
        notifyUser(uid, {
          title: "Evaluările sunt vizibile",
          body: `Evaluările pentru „${job.title}” sunt acum publice.`,
          url: `/u/${uid}`,
        });
      }
    } else {
      notifyUser(
        data.toUserId,
        {
          title: "Ai primit o evaluare",
          body: `${fromName} te-a evaluat pentru „${job.title}”. Evaluează-l și tu ca s-o vezi.`,
          url: "/cont?tab=ratings",
        },
        context.userId,
      );
    }
    return { ok: true as const };
  });

/** "Jobul nu a avut loc": answer the prompt without stars; flags it for the admin. */
export const skipRating = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ jobId: z.number().int(), toUserId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureRatingsTable();
    const { job } = await assertCanRate(data.jobId, context.userId, data.toUserId);
    const sql = await getSql();
    await sql.query(
      `insert into rating_skips (job_id, from_user_id, to_user_id, reason) values ($1, $2, $3, 'no_show')
       on conflict do nothing`,
      [data.jobId, context.userId, data.toUserId],
    );
    await sql.query(`delete from rating_prompts where user_id = $1 and job_id = $2 and to_user_id = $3`, [
      context.userId,
      data.jobId,
      data.toUserId,
    ]);
    try {
      const { ensureCommunityTables } = await import("./community");
      await ensureCommunityTables();
      await sql.query(
        `insert into reports (reporter_id, target_type, target_id, reason, details)
         values ($1, 'user', $2, 'noshow', $3)`,
        [context.userId, data.toUserId, `Jobul nu a avut loc: #${job.id} „${job.title}”`],
      );
    } catch (err) {
      console.error("[ratings] no-show report failed", err);
    }
    return { ok: true as const };
  });

/** "Mai târziu": hide this rating prompt for 24 hours. */
export const snoozeRating = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ jobId: z.number().int(), toUserId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await ensureRatingsTable();
    const sql = await getSql();
    await sql.query(
      `insert into rating_prompts (user_id, job_id, to_user_id, snoozed_until)
       values ($1, $2, $3, now() + interval '24 hours')
       on conflict (user_id, job_id, to_user_id) do update set snoozed_until = excluded.snoozed_until`,
      [context.userId, data.jobId, data.toUserId],
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
       from ratings r where r.to_user_id = $1 and ${VISIBLE_RATING_SQL("r")}`,
      [userId],
    );
    const reviews = await sql.query<PublicReview>(
      `select r.id, r.stars, r.comment, r.tags, r.created_at, r.from_user_id, r.job_id,
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
       where r.to_user_id = $1 and ${VISIBLE_RATING_SQL("r")}
       order by r.created_at desc
       limit 50`,
      [userId],
    );
    const breakdownRows = await sql.query<{ stars: number; n: number }>(
      `select r.stars, count(*)::int as n from ratings r
       where r.to_user_id = $1 and ${VISIBLE_RATING_SQL("r")} group by r.stars`,
      [userId],
    );
    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      n: breakdownRows.find((r) => Number(r.stars) === stars)?.n ?? 0,
    }));
    const tagRows = await sql.query<{ tag: string; n: number }>(
      `select t.tag, count(*)::int as n
       from ratings r, unnest(r.tags) as t(tag)
       where r.to_user_id = $1 and ${VISIBLE_RATING_SQL("r")}
       group by t.tag order by n desc, t.tag limit 6`,
      [userId],
    );
    const topTags = tagRows.map((r) => ({ tag: r.tag, n: Number(r.n), good: GOOD_TAGS.has(r.tag) }));
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
      topTags,
    } satisfies RatingSummary;
  });

type PendingRow = {
  job_id: number;
  job_title: string;
  other_user_id: string;
  other_name: string;
  other_role: "poster" | "worker";
  ended_at: string | null;
  locality: string;
};

/** Pairs the user can still rate (not rated, not skipped), newest first. */
async function pendingFor(userId: string, opts: { excludeSnoozed: boolean }): Promise<PendingRating[]> {
  await ensureRatingsTable();
  const sql = await getSql();
  const snoozed = opts.excludeSnoozed
    ? `and not exists (select 1 from rating_prompts rp where rp.user_id = $1 and rp.job_id = j.id
         and rp.to_user_id = OTHER and rp.snoozed_until > now())`
    : "";
  const answered = (other: string) => `
    and not exists (select 1 from ratings r where r.job_id = j.id and r.from_user_id = $1 and r.to_user_id = ${other})
    and not exists (select 1 from rating_skips s where s.job_id = j.id and s.from_user_id = $1 and s.to_user_id = ${other})
    and ${other} not like 'deleted-%'
    ${snoozed.replace("OTHER", other)}`;
  const rows = await sql.query<PendingRow>(
    `select * from (
       select j.id as job_id, j.title as job_title, a.user_id as other_user_id,
              coalesce(nullif(trim(both from concat_ws(' ', nullif(a.first_name, ''), nullif(a.last_name, ''))), ''), a.applicant_name, 'Muncitor') as other_name,
              'worker' as other_role, ${JOB_END_SQL("j")} as ended_at, j.locality
       from jobs j
       join applications a on a.job_id = j.id and a.status = 'selected'
       where j.user_id = $1 and ${RATABLE_JOB_SQL("j")} ${answered("a.user_id")}
       union all
       select j.id as job_id, j.title as job_title, j.user_id as other_user_id,
              coalesce(j.poster_name, 'Utilizator') as other_name,
              'poster' as other_role, ${JOB_END_SQL("j")} as ended_at, j.locality
       from applications a
       join jobs j on j.id = a.job_id
       where a.user_id = $1 and a.status = 'selected' and ${RATABLE_JOB_SQL("j")} ${answered("j.user_id")}
     ) p
     order by ended_at desc nulls last`,
    [userId],
  );
  return rows.map((row) => ({
    jobId: row.job_id,
    jobTitle: row.job_title,
    otherUserId: row.other_user_id,
    otherName: row.other_name,
    otherRole: row.other_role,
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    locality: row.locality ?? "",
  }));
}

export const listPendingRatings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => pendingFor(context.userId, { excludeSnoozed: false }));

/** For the pop-up: like listPendingRatings, minus prompts snoozed with "Mai târziu". */
export const listRatingPrompts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => pendingFor(context.userId, { excludeSnoozed: true }));

/** Ratings the user received that stay hidden until they rate back. */
export const countHiddenRatings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureRatingsTable();
    const sql = await getSql();
    const rows = await sql.query<{ n: number }>(
      `select count(*)::int as n from ratings r where r.to_user_id = $1 and not ${VISIBLE_RATING_SQL("r")}`,
      [context.userId],
    );
    return Number(rows[0]?.n ?? 0);
  });

let remindersRunning = false;
let remindersLastRun = 0;

/**
 * Push reminders for unanswered ratings: one ~2h after the job ended, one
 * more 2 days later. Throttled to once per 10 minutes per process; called
 * opportunistically from busy endpoints (there is no cron).
 */
export async function maybeSendRatingReminders() {
  const now = Date.now();
  if (remindersRunning || now - remindersLastRun < 10 * 60 * 1000) return;
  remindersRunning = true;
  remindersLastRun = now;
  try {
    await ensureRatingsTable();
    const sql = await getSql();
    const due = await sql.query<{ user_id: string; job_id: number; to_user_id: string; title: string; other_name: string; sent: number }>(
      `with pairs as (
         select j.user_id as user_id, j.id as job_id, a.user_id as to_user_id, j.title,
                coalesce(nullif(trim(both from concat_ws(' ', nullif(a.first_name, ''), nullif(a.last_name, ''))), ''), a.applicant_name, 'muncitorul') as other_name
         from jobs j join applications a on a.job_id = j.id and a.status = 'selected'
         where ${RATABLE_JOB_SQL("j")}
         union all
         select a.user_id, j.id, j.user_id, j.title, coalesce(j.poster_name, 'angajatorul')
         from jobs j join applications a on a.job_id = j.id and a.status = 'selected'
         where ${RATABLE_JOB_SQL("j")}
       )
       select p.user_id, p.job_id, p.to_user_id, p.title, p.other_name, coalesce(rp.reminders_sent, 0) as sent
       from pairs p
       left join rating_prompts rp on rp.user_id = p.user_id and rp.job_id = p.job_id and rp.to_user_id = p.to_user_id
       where p.to_user_id not like 'deleted-%'
         and not exists (select 1 from ratings r where r.job_id = p.job_id and r.from_user_id = p.user_id and r.to_user_id = p.to_user_id)
         and not exists (select 1 from rating_skips s where s.job_id = p.job_id and s.from_user_id = p.user_id and s.to_user_id = p.to_user_id)
         and (coalesce(rp.reminders_sent, 0) = 0
              or (rp.reminders_sent = 1 and rp.last_reminded_at <= now() - interval '2 days'))
       limit 200`,
    );
    for (const row of due) {
      await sql.query(
        `insert into rating_prompts (user_id, job_id, to_user_id, reminders_sent, last_reminded_at)
         values ($1, $2, $3, 1, now())
         on conflict (user_id, job_id, to_user_id)
         do update set reminders_sent = rating_prompts.reminders_sent + 1, last_reminded_at = now()`,
        [row.user_id, row.job_id, row.to_user_id],
      );
      notifyUser(row.user_id, {
        title: Number(row.sent) === 0 ? "Cum a fost?" : "Nu uita să evaluezi",
        body: `Lasă o evaluare pentru ${row.other_name} („${row.title}”). Durează 10 secunde.`,
        url: "/cont?tab=ratings",
      });
    }
  } catch (err) {
    console.error("[ratings] reminders failed", err);
  } finally {
    remindersRunning = false;
  }
}

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
