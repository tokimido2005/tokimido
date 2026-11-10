import "@tanstack/react-start/server-only";
import { getSql } from "@/lib/db";
import { ADULT_AGE, ageFromYear } from "@/lib/age";

/** Immediate alerts per user per day (per channel); the rest go in the evening digest. */
export const DAILY_ALERTS = 5;
/** Local hour (Chișinău) after which the digest goes out. */
const DIGEST_HOUR = Number(process.env.ALERT_DIGEST_HOUR ?? 19);

function chisinauParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

type NewJob = {
  jobId: number;
  title: string;
  raion: string;
  locality?: string;
  category: string;
  kind: "rapid" | "oficial";
  payment: number;
  adultsOnly: boolean;
  exceptUserId: string;
  headline?: string;
  /** Urgent boost: ignore the category filter. */
  priority?: boolean;
};

function money(n: number, kind: string) {
  if (!n) return "";
  const v = new Intl.NumberFormat("ro-MD").format(n);
  return kind === "oficial" ? `${v} MDL/lună` : `${v} MDL`;
}

/** Send a new job to everyone whose alerts match it (Telegram + browser, 5/day, rest in digest). */
/** Alerts are read and sent in pages of this size. */
const ALERT_PAGE = 500;

export async function dispatchJobAlert(job: NewJob) {
  try {
    const sql = await getSql();
    const place = [job.locality, job.raion].filter(Boolean).join(", ");
    const payload = {
      title:
        job.headline ||
        (job.kind === "oficial" ? "Angajare nouă pentru tine" : "Lucru nou pentru tine"),
      body: [job.title, place, money(job.payment, job.kind)].filter(Boolean).join(" · "),
      url: `/jobs/${job.jobId}`,
    };
    const { notifyUsers } = await import("./push.server");
    const { notifyTelegram } = await import("./telegram.server");
    // Everyone whose alert matches, in pages of 500 (ordered by id), so a
    // big city with thousands of alerts still reaches the last person.
    let after = "";
    for (let page = 0; page < 200; page += 1) {
      const rows = await sql.query<{
        user_id: string;
        via_push: boolean;
        via_telegram: boolean;
        birth_year: number | null;
        sent_today: number;
      }>(
        `select a.user_id, a.via_push, a.via_telegram, p.birth_year,
                (select count(*)::int from alert_log l
                  where l.user_id = a.user_id and l.channel = 'job'
                    and l.sent_at > now() - interval '20 hours') as sent_today
         from job_alerts a
         left join profiles p on p.user_id = a.user_id
         where a.paused = false
           and a.user_id <> $1
           and $2 = any(a.kinds)
           and (cardinality(a.raions) = 0 or $3 = any(a.raions))
           and ($5 or cardinality(a.categories) = 0 or $4 = any(a.categories))
           and a.user_id > $6
         order by a.user_id
         limit ${ALERT_PAGE}`,
        [job.exceptUserId, job.kind, job.raion, job.category, Boolean(job.priority), after],
      );
      if (rows.length === 0) break;
      after = rows[rows.length - 1].user_id;

      const eligible = rows.filter((r) => {
        if (!job.adultsOnly) return true;
        const age = ageFromYear(r.birth_year);
        return age === null || age >= ADULT_AGE;
      });
      const now = eligible.filter((r) => r.sent_today < DAILY_ALERTS);
      const later = eligible.filter((r) => r.sent_today >= DAILY_ALERTS);
      if (later.length > 0) {
        await sql.query(
          `insert into alert_queue (user_id, job_id) select unnest($1::text[]), $2 on conflict do nothing`,
          [later.map((r) => r.user_id), job.jobId],
        );
      }
      if (now.length > 0) {
        await notifyUsers(
          now.filter((r) => r.via_push).map((r) => r.user_id),
          payload,
          job.exceptUserId,
        );
        await notifyTelegram(
          now.filter((r) => r.via_telegram).map((r) => r.user_id),
          payload,
        );
        await sql.query(
          `insert into alert_log (user_id, job_id, channel) select unnest($1::text[]), $2, 'job'`,
          [now.map((r) => r.user_id), job.jobId],
        );
      }
      if (rows.length < ALERT_PAGE) break;
    }
  } catch (err) {
    console.error("[alerts] dispatch", err);
  }
}

let digestCheckedAt = 0;

/** Evening digest of queued alerts (runs on normal traffic, at most every 30 minutes). */
export async function maybeSendDigests() {
  if (Date.now() - digestCheckedAt < 30 * 60_000) return;
  digestCheckedAt = Date.now();
  const { hour } = chisinauParts();
  if (hour < DIGEST_HOUR) return;
  try {
    const sql = await getSql();
    for (let round = 0; round < 40; round += 1) {
      const users = await sql.query<{
        user_id: string;
        via_push: boolean;
        via_telegram: boolean;
        n: number;
      }>(
        `select q.user_id, coalesce(a.via_push, true) as via_push, coalesce(a.via_telegram, true) as via_telegram,
              count(*)::int as n
       from alert_queue q
       left join job_alerts a on a.user_id = q.user_id
       where coalesce(a.paused, false) = false
       group by q.user_id, a.via_push, a.via_telegram
       limit 500`,
      );
      const { notifyUsers } = await import("./push.server");
      const { notifyTelegram } = await import("./telegram.server");
      for (const u of users) {
        const jobs = await sql.query<{ id: number; title: string; raion: string }>(
          `select j.id, j.title, j.raion from alert_queue q join jobs j on j.id = q.job_id
         where q.user_id = $1 and j.status = 'open'
         order by q.created_at desc limit 8`,
          [u.user_id],
        );
        await sql.query(`delete from alert_queue where user_id = $1`, [u.user_id]);
        if (jobs.length === 0) continue;
        const payload = {
          title: `Încă ${u.n} ${u.n === 1 ? "anunț nou" : "anunțuri noi"} pentru tine azi`,
          body: jobs.map((j) => `• ${j.title} (${j.raion})`).join("\n"),
          url: jobs.length === 1 ? `/jobs/${jobs[0].id}` : "/alerte",
        };
        if (u.via_push)
          await notifyUsers([u.user_id], {
            ...payload,
            body: jobs.map((j) => j.title).join(" · "),
          });
        if (u.via_telegram) await notifyTelegram([u.user_id], payload);
        await sql.query(`insert into alert_log (user_id, channel) values ($1, 'digest')`, [
          u.user_id,
        ]);
      }
      if (users.length < 500) break;
    }
    // Old log rows are not needed after a month.
    await sql.query(`delete from alert_log where sent_at < now() - interval '30 days'`);
  } catch (err) {
    console.error("[alerts] digest", err);
  }
}
