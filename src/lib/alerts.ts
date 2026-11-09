import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { CATEGORIES } from "@/lib/categories";
import { OFFICIAL_CATEGORIES } from "@/lib/job-kinds";
import { RAION_NAMES } from "@/lib/moldova";

export type MyAlerts = {
  raions: string[];
  categories: string[];
  kinds: Array<"rapid" | "oficial">;
  via_push: boolean;
  via_telegram: boolean;
  paused: boolean;
  exists: boolean;
  telegramLinked: boolean;
  pushDevices: number;
};

export const getMyAlerts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<MyAlerts> => {
    const sql = await getSql();
    const rows = await sql.query<{
      raions: string[];
      categories: string[];
      kinds: string[];
      via_push: boolean;
      via_telegram: boolean;
      paused: boolean;
    }>(`select raions, categories, kinds, via_push, via_telegram, paused from job_alerts where user_id = $1`, [
      context.userId,
    ]);
    const [tg, push, prof] = await Promise.all([
      sql.query<{ n: number }>(`select count(*)::int as n from telegram_links where user_id = $1`, [context.userId]).catch(
        () => [{ n: 0 }],
      ),
      sql.query<{ n: number }>(`select count(*)::int as n from push_devices where user_id = $1`, [context.userId]).catch(
        () => [{ n: 0 }],
      ),
      sql.query<{ notify_raion: string | null }>(`select notify_raion from profiles where user_id = $1`, [context.userId]),
    ]);
    const r = rows[0];
    return {
      raions: r?.raions ?? (prof[0]?.notify_raion ? [prof[0].notify_raion] : []),
      categories: r?.categories ?? [],
      kinds: (r?.kinds ?? ["rapid", "oficial"]).filter((k): k is "rapid" | "oficial" => k === "rapid" || k === "oficial"),
      via_push: r?.via_push ?? true,
      via_telegram: r?.via_telegram ?? true,
      paused: r?.paused ?? false,
      exists: Boolean(r),
      telegramLinked: (tg[0]?.n ?? 0) > 0,
      pushDevices: push[0]?.n ?? 0,
    };
  });

const CATEGORY_IDS = new Set<string>([...CATEGORIES.map((c) => c.id), ...OFFICIAL_CATEGORIES.map((c) => c.id)]);
const RAIONS = new Set<string>(RAION_NAMES);

export const saveMyAlerts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        raions: z.array(z.string()).max(40),
        categories: z.array(z.string()).max(30),
        kinds: z.array(z.enum(["rapid", "oficial"])).min(1).max(2),
        via_push: z.boolean(),
        via_telegram: z.boolean(),
        paused: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const raions = [...new Set(data.raions.filter((r) => RAIONS.has(r)))];
    const categories = [...new Set(data.categories.filter((c) => CATEGORY_IDS.has(c)))];
    const sql = await getSql();
    await sql.query(
      `insert into job_alerts (user_id, raions, categories, kinds, via_push, via_telegram, paused, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, now())
       on conflict (user_id) do update set raions = excluded.raions, categories = excluded.categories,
         kinds = excluded.kinds, via_push = excluded.via_push, via_telegram = excluded.via_telegram,
         paused = excluded.paused, updated_at = now()`,
      [context.userId, raions, categories, data.kinds, data.via_push, data.via_telegram, data.paused],
    );
    // Keep the old single-raion field in sync for older code paths.
    await sql.query(`update profiles set notify_raion = $2 where user_id = $1`, [context.userId, raions[0] ?? ""]);
    return { ok: true as const };
  });

export type AlertMatch = {
  id: number;
  title: string;
  raion: string;
  locality: string;
  payment_mdl: number;
  kind: string;
  company: string;
  created_at: string;
};

/** Open listings that match the user's alerts (newest first). */
export const listAlertMatches = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    return sql.query<AlertMatch>(
      `select j.id, j.title, j.raion, j.locality, j.payment_mdl, coalesce(j.kind, 'rapid') as kind,
              coalesce(j.company, '') as company, j.created_at
       from job_alerts a
       join jobs j on j.status = 'open' and coalesce(j.hidden, false) = false and j.user_id <> a.user_id
         and coalesce(j.kind, 'rapid') = any(a.kinds)
         and (cardinality(a.raions) = 0 or j.raion = any(a.raions))
         and (cardinality(a.categories) = 0 or j.category = any(a.categories))
       where a.user_id = $1
       order by j.created_at desc
       limit 20`,
      [context.userId],
    );
  });
