import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type DayStats = {
  day: string;
  visitors: number;
  views: number;
  jobsRapid: number;
  jobsOficial: number;
  apps: number;
  selected: number;
  users: number;
};

export type GrowthStats = {
  days: DayStats[]; // oldest first, 60 days ending today (Chișinău)
  sources: Array<{ source: string; visitors: number }>;
  pages: Array<{ path: string; views: number; visitors: number }>;
  raions: Array<{ raion: string; jobs: number; apps: number }>;
  categories: Array<{ category: string; kind: string; jobs: number }>;
  searches: Array<{ q: string; n: number; zero: number }>;
  zeroSearches: Array<{ q: string; n: number }>;
  notify: { users: number; telegram: number; push: number; any: number };
};

const TZ = `'Europe/Chisinau'`;

function lastDays(n: number) {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" });
  const out: string[] = [];
  // Noon-anchored steps avoid skipping or repeating a day around DST changes.
  const today = new Date(`${fmt.format(new Date())}T12:00:00Z`).getTime();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(today - i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

/** Growth numbers for the admin overview (last 60 days, Chișinău days). */
export const adminGrowthStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<GrowthStats> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    const days = lastDays(60);
    const from = days[0];
    const from30 = days[30];
    const safe = async <T>(text: string, params: unknown[] = []): Promise<T[]> => {
      try {
        return await sql.query<T>(text, params);
      } catch (err) {
        console.error("[stats]", err);
        return [];
      }
    };
    const dayOf = (col: string) => `(${col} at time zone ${TZ})::date`;
    const [jobs, apps, selected, users, views, sources, pages, raions, categories, searches, zero] = await Promise.all([
      safe<{ day: string; kind: string; n: number }>(
        `select ${dayOf("created_at")} as day, coalesce(kind, 'rapid') as kind, count(*)::int as n
         from jobs where ${dayOf("created_at")} >= $1::date group by 1, 2`,
        [from],
      ),
      safe<{ day: string; n: number }>(
        `select ${dayOf("created_at")} as day, count(*)::int as n
         from applications where ${dayOf("created_at")} >= $1::date group by 1`,
        [from],
      ),
      safe<{ day: string; n: number }>(
        `select ${dayOf("coalesce(selected_at, created_at)")} as day, count(*)::int as n
         from applications where status = 'selected' and ${dayOf("coalesce(selected_at, created_at)")} >= $1::date group by 1`,
        [from],
      ),
      safe<{ day: string; n: number }>(
        `select ${dayOf(`"createdAt"`)} as day, count(*)::int as n
         from "user" where ${dayOf(`"createdAt"`)} >= $1::date group by 1`,
        [from],
      ),
      safe<{ day: string; views: number; visitors: number }>(
        `select day, count(*)::int as views, count(distinct visitor)::int as visitors
         from page_views where day >= $1::date group by 1`,
        [from],
      ),
      safe<{ source: string; visitors: number }>(
        `select source, count(distinct visitor)::int as visitors
         from page_views where day >= $1::date and source <> 'internal'
         group by 1 order by 2 desc`,
        [from30],
      ),
      safe<{ path: string; views: number; visitors: number }>(
        `select path, count(*)::int as views, count(distinct visitor)::int as visitors
         from page_views where day >= $1::date group by 1 order by 2 desc limit 12`,
        [from30],
      ),
      safe<{ raion: string; jobs: number; apps: number }>(
        `select j.raion,
                count(distinct j.id)::int as jobs,
                count(a.id)::int as apps
         from jobs j left join applications a on a.job_id = j.id
         where ${dayOf("j.created_at")} >= $1::date and coalesce(j.raion, '') <> ''
         group by 1 order by 2 desc, 3 desc limit 12`,
        [from30],
      ),
      safe<{ category: string; kind: string; jobs: number }>(
        `select category, coalesce(kind, 'rapid') as kind, count(*)::int as jobs
         from jobs where ${dayOf("created_at")} >= $1::date
         group by 1, 2 order by 3 desc limit 12`,
        [from30],
      ),
      safe<{ q: string; n: number; zero: number }>(
        `select q, count(*)::int as n, count(*) filter (where results = 0)::int as zero
         from site_searches where day >= $1::date group by 1 order by 2 desc limit 15`,
        [from30],
      ),
      safe<{ q: string; n: number }>(
        `select q, count(*)::int as n
         from site_searches where day >= $1::date and results = 0
         group by 1 order by 2 desc limit 15`,
        [from30],
      ),
    ]);

    const notifyRows = await safe<{ users: number; telegram: number; push: number; any: number }>(
      `select (select count(*)::int from "user") as users,
              (select count(distinct user_id)::int from telegram_links) as telegram,
              (select count(distinct user_id)::int from push_devices) as push,
              (select count(*)::int from "user" u
                where exists (select 1 from telegram_links t where t.user_id = u.id)
                   or exists (select 1 from push_devices d where d.user_id = u.id)) as any`,
    );
    const notify = notifyRows[0] ?? { users: 0, telegram: 0, push: 0, any: 0 };

    const map = new Map<string, DayStats>(
      days.map((day) => [
        day,
        { day, visitors: 0, views: 0, jobsRapid: 0, jobsOficial: 0, apps: 0, selected: 0, users: 0 },
      ]),
    );
    const at = (d: unknown) => map.get(String(d).slice(0, 10));
    for (const r of jobs) {
      const d = at(r.day);
      if (d) d[r.kind === "oficial" ? "jobsOficial" : "jobsRapid"] += r.n;
    }
    const add = (rows: Array<{ day: string; n: number }>, key: "apps" | "selected" | "users") => {
      for (const r of rows) {
        const d = at(r.day);
        if (d) d[key] += r.n;
      }
    };
    add(apps, "apps");
    add(selected, "selected");
    add(users, "users");
    for (const r of views) {
      const d = at(r.day);
      if (d) {
        d.views += r.views;
        d.visitors += r.visitors;
      }
    }
    return { days: [...map.values()], sources, pages, raions, categories, searches, zeroSearches: zero, notify };
  });
