import { getSql } from "@/lib/db";
import { JOB_END_SQL, RATABLE_JOB_SQL } from "@/lib/ratings";

/**
 * Tell people (push + Telegram) when they can review the person they worked
 * with, and remind once more a day later if they still haven't. Reviews
 * open 2 hours after a job ends (or when it is marked finished). Only jobs
 * that ended in the last 3 days get a first message, so old history is
 * never spammed. Runs at most every 10 minutes.
 */
let lastRun = 0;

type Pair = { job_id: number; title: string; from_user_id: string; to_user_id: string; other_name: string; stage: number | null };

export async function maybeSendRatingReminders() {
  if (Date.now() - lastRun < 10 * 60_000) return;
  lastRun = Date.now();
  const sql = await getSql();
  await sql.query(`create table if not exists rating_reminders (
    job_id integer not null, from_user_id text not null, to_user_id text not null,
    stage integer not null default 1, sent_at timestamptz not null default now(),
    primary key (job_id, from_user_id, to_user_id))`);
  const notAnswered = (from: string, to: string) => `
    not exists (select 1 from ratings r where r.job_id = j.id and r.from_user_id = ${from} and r.to_user_id = ${to})
    and not exists (select 1 from rating_skips s where s.job_id = j.id and s.from_user_id = ${from} and s.to_user_id = ${to})
    and ${to} not like 'deleted-%' and ${from} not like 'deleted-%'`;
  const pairs = await sql.query<Pair>(
    `select p.*, rr.stage from (
       select j.id as job_id, j.title, j.user_id as from_user_id, a.user_id as to_user_id,
              coalesce(nullif(trim(both from concat_ws(' ', nullif(a.first_name, ''), nullif(a.last_name, ''))), ''), a.applicant_name, 'Muncitor') as other_name,
              ${JOB_END_SQL("j")} as ended_at
       from jobs j join applications a on a.job_id = j.id and a.status = 'selected'
       where ${RATABLE_JOB_SQL("j")} and ${notAnswered("j.user_id", "a.user_id")}
       union all
       select j.id, j.title, a.user_id, j.user_id, coalesce(j.poster_name, 'Utilizator'), ${JOB_END_SQL("j")}
       from jobs j join applications a on a.job_id = j.id and a.status = 'selected'
       where ${RATABLE_JOB_SQL("j")} and ${notAnswered("a.user_id", "j.user_id")}
     ) p
     left join rating_reminders rr on rr.job_id = p.job_id and rr.from_user_id = p.from_user_id and rr.to_user_id = p.to_user_id
     where (rr.stage is null and p.ended_at > now() - interval '3 days')
        or (rr.stage = 1 and rr.sent_at < now() - interval '24 hours')
     limit 300`,
  );
  if (pairs.length === 0) return;

  // One message per person, even if they have several reviews to leave.
  const byUser = new Map<string, Pair[]>();
  for (const p of pairs) byUser.set(p.from_user_id, [...(byUser.get(p.from_user_id) ?? []), p]);
  const { notifyUser } = await import("./push.server");
  for (const [userId, list] of byUser) {
    const first = list[0];
    const reminder = list.every((p) => p.stage === 1);
    const body =
      list.length > 1
        ? `Ai ${list.length} recenzii de lăsat. Durează câteva secunde și îi ajută pe alții să aleagă.`
        : `${reminder ? "Încă nu ai lăsat o recenzie pentru" : "Lasă o recenzie pentru"} ${first.other_name} („${first.title}”). Durează 10 secunde.`;
    try {
      await notifyUser(userId, { title: "Cum a fost? ⭐", body, url: "/cont?tab=ratings", telegram: true });
    } catch (err) {
      console.warn("[rating-reminders]", err);
    }
    for (const p of list) {
      await sql.query(
        `insert into rating_reminders (job_id, from_user_id, to_user_id, stage, sent_at)
         values ($1, $2, $3, 1, now())
         on conflict (job_id, from_user_id, to_user_id) do update set stage = rating_reminders.stage + 1, sent_at = now()`,
        [p.job_id, p.from_user_id, p.to_user_id],
      );
    }
  }
}
