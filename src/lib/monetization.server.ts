import "@tanstack/react-start/server-only";
import { getSql } from "@/lib/db";

export const MONEY_MODES = ["free", "freemium", "paid"] as const;
export type MoneyMode = (typeof MONEY_MODES)[number];

export type MonetizationSettings = {
  mode: MoneyMode;
  monthlyPriceMdl: number;
  freeJobLimit: number;
  freeApplyLimit: number;
  updatedAt: string | null;
  updatedBy: string;
};

export type MonetizationAccess = MonetizationSettings & {
  isPro: boolean;
  isAdmin: boolean;
  proUntil: string | null;
  jobsUsed: number;
  appliesUsed: number;
  canPost: boolean;
  canApply: boolean;
};

export type MonetizationLogRow = {
  id: number;
  admin_id: string;
  admin_name: string;
  from_mode: string;
  to_mode: string;
  monthly_price_mdl: number;
  free_job_limit: number;
  free_apply_limit: number;
  note: string;
  created_at: string;
};

export type ProSubscriber = {
  user_id: string;
  name: string;
  email: string | null;
  source: string;
  started_at: string;
  expires_at: string;
};

const DEFAULTS: MonetizationSettings = {
  mode: "free",
  monthlyPriceMdl: 49,
  freeJobLimit: 2,
  freeApplyLimit: 5,
  updatedAt: null,
  updatedBy: "",
};

export function isMoneyMode(v: string): v is MoneyMode {
  return (MONEY_MODES as readonly string[]).includes(v);
}

export async function ensureMonetizationTables() {
  const sql = await getSql();
  await sql.query(`
    create table if not exists monetization_settings (
      id integer primary key default 1,
      mode text not null default 'free',
      monthly_price_mdl integer not null default 49,
      free_job_limit integer not null default 2,
      free_apply_limit integer not null default 5,
      updated_at timestamptz not null default now(),
      updated_by text not null default ''
    )
  `);
  await sql.query(`
    insert into monetization_settings (id, mode, monthly_price_mdl, free_job_limit, free_apply_limit)
    values (1, 'free', 49, 2, 5)
    on conflict (id) do nothing
  `);
  await sql.query(`
    create table if not exists subscriptions (
      id serial primary key,
      user_id text not null,
      status text not null default 'active',
      source text not null default 'self',
      started_at timestamptz not null default now(),
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `);
  await sql.query(`create index if not exists subscriptions_user_idx on subscriptions (user_id, expires_at desc)`);
  await sql.query(`
    create table if not exists monetization_log (
      id serial primary key,
      admin_id text not null,
      from_mode text not null default '',
      to_mode text not null,
      monthly_price_mdl integer not null,
      free_job_limit integer not null,
      free_apply_limit integer not null,
      note text not null default '',
      created_at timestamptz not null default now()
    )
  `);
}

function clampInt(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function readSettings(): Promise<MonetizationSettings> {
  await ensureMonetizationTables();
  const sql = await getSql();
  const rows = await sql.query<{
    mode: string;
    monthly_price_mdl: number;
    free_job_limit: number;
    free_apply_limit: number;
    updated_at: string | null;
    updated_by: string;
  }>(
    `select mode, monthly_price_mdl, free_job_limit, free_apply_limit, updated_at, updated_by
     from monetization_settings where id = 1`,
  );
  const row = rows[0];
  if (!row) return DEFAULTS;
  return {
    mode: isMoneyMode(row.mode) ? row.mode : "free",
    monthlyPriceMdl: clampInt(Number(row.monthly_price_mdl), 1, 5000, 49),
    freeJobLimit: clampInt(Number(row.free_job_limit), 0, 100, 2),
    freeApplyLimit: clampInt(Number(row.free_apply_limit), 0, 200, 5),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? "",
  };
}

export async function writeSettings(
  adminId: string,
  next: { mode: MoneyMode; monthlyPriceMdl: number; freeJobLimit: number; freeApplyLimit: number },
) {
  await ensureMonetizationTables();
  const current = await readSettings();
  const monthlyPriceMdl = clampInt(next.monthlyPriceMdl, 1, 5000, current.monthlyPriceMdl);
  const freeJobLimit = clampInt(next.freeJobLimit, 0, 100, current.freeJobLimit);
  const freeApplyLimit = clampInt(next.freeApplyLimit, 0, 200, current.freeApplyLimit);
  const sql = await getSql();
  await sql.query(
    `insert into monetization_settings
       (id, mode, monthly_price_mdl, free_job_limit, free_apply_limit, updated_at, updated_by)
     values (1, $1, $2, $3, $4, now(), $5)
     on conflict (id) do update set
       mode = excluded.mode,
       monthly_price_mdl = excluded.monthly_price_mdl,
       free_job_limit = excluded.free_job_limit,
       free_apply_limit = excluded.free_apply_limit,
       updated_at = now(),
       updated_by = excluded.updated_by`,
    [next.mode, monthlyPriceMdl, freeJobLimit, freeApplyLimit, adminId],
  );
  const note = `${current.mode} → ${next.mode} · ${monthlyPriceMdl} MDL · ${freeJobLimit} anunțuri · ${freeApplyLimit} aplicații`;
  await sql.query(
    `insert into monetization_log
       (admin_id, from_mode, to_mode, monthly_price_mdl, free_job_limit, free_apply_limit, note)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [adminId, current.mode, next.mode, monthlyPriceMdl, freeJobLimit, freeApplyLimit, note],
  );
  const { logAdminAction } = await import("./admin.server");
  await logAdminAction(
    adminId,
    current.mode === next.mode ? "monetization.update" : "monetization.mode",
    "monetization",
    next.mode,
    note,
  );
  return readSettings();
}

export async function activeProUntil(userId: string): Promise<string | null> {
  await ensureMonetizationTables();
  const sql = await getSql();
  const rows = await sql.query<{ expires_at: string }>(
    `select expires_at from subscriptions
     where user_id = $1 and status = 'active' and expires_at > now()
     order by expires_at desc limit 1`,
    [userId],
  );
  return rows[0]?.expires_at ?? null;
}

export async function monthUsage(userId: string) {
  const sql = await getSql();
  const [jobs, apps] = await Promise.all([
    sql.query<{ n: number }>(
      `select count(*)::int as n from jobs
       where user_id = $1 and created_at >= date_trunc('month', now())`,
      [userId],
    ),
    sql.query<{ n: number }>(
      `select count(*)::int as n from applications
       where user_id = $1 and created_at >= date_trunc('month', now())
         and status <> 'withdrawn'`,
      [userId],
    ),
  ]);
  return { jobsUsed: jobs[0]?.n ?? 0, appliesUsed: apps[0]?.n ?? 0 };
}

export async function getAccessFor(userId: string | null): Promise<MonetizationAccess> {
  const settings = await readSettings();
  if (!userId) {
    const open = settings.mode === "free";
    return {
      ...settings,
      isPro: false,
      isAdmin: false,
      proUntil: null,
      jobsUsed: 0,
      appliesUsed: 0,
      canPost: open,
      canApply: open,
    };
  }
  const { isAdminId } = await import("./admin.server");
  const admin = await isAdminId(userId);
  const proUntil = admin ? null : await activeProUntil(userId);
  const isPro = admin || Boolean(proUntil);
  const usage = await monthUsage(userId);
  const canPost =
    admin ||
    isPro ||
    settings.mode === "free" ||
    (settings.mode === "freemium" && usage.jobsUsed < settings.freeJobLimit);
  const canApply =
    admin ||
    isPro ||
    settings.mode === "free" ||
    (settings.mode === "freemium" && usage.appliesUsed < settings.freeApplyLimit);
  return {
    ...settings,
    isPro,
    isAdmin: admin,
    proUntil,
    jobsUsed: usage.jobsUsed,
    appliesUsed: usage.appliesUsed,
    canPost,
    canApply,
  };
}

export async function assertCanPost(userId: string) {
  const access = await getAccessFor(userId);
  if (access.canPost) return access;
  if (access.mode === "paid") {
    throw new Error("Pentru a posta anunțuri ai nevoie de un abonament Pro.");
  }
  throw new Error("Ai atins limita gratuită de anunțuri luna aceasta. Activează Pro pentru nelimitat.");
}

export async function assertCanApply(userId: string) {
  const access = await getAccessFor(userId);
  if (access.canApply) return access;
  if (access.mode === "paid") {
    throw new Error("Pentru a aplica ai nevoie de un abonament Pro.");
  }
  throw new Error("Ai atins limita gratuită de aplicații luna aceasta. Activează Pro pentru nelimitat.");
}

export async function grantSubscription(userId: string, days: number, source: "self" | "admin", actorId?: string) {
  await ensureMonetizationTables();
  const safeDays = clampInt(days, 1, 730, 30);
  const sql = await getSql();
  const current = await activeProUntil(userId);
  const base = current && new Date(current).getTime() > Date.now() ? new Date(current) : new Date();
  const expires = new Date(base.getTime() + safeDays * 24 * 60 * 60 * 1000);
  await sql.query(
    `insert into subscriptions (user_id, status, source, started_at, expires_at)
     values ($1, 'active', $2, now(), $3)`,
    [userId, source, expires.toISOString()],
  );
  if (source === "admin" && actorId) {
    const { logAdminAction } = await import("./admin.server");
    await logAdminAction(actorId, "monetization.grant", "user", userId, `${safeDays}d`);
  }
  return { expiresAt: expires.toISOString() };
}

export async function revokeSubscription(userId: string, actorId: string) {
  await ensureMonetizationTables();
  const sql = await getSql();
  await sql.query(
    `update subscriptions set status = 'cancelled', expires_at = now()
     where user_id = $1 and status = 'active' and expires_at > now()`,
    [userId],
  );
  const { logAdminAction } = await import("./admin.server");
  await logAdminAction(actorId, "monetization.revoke", "user", userId, "");
}

export async function countActivePros() {
  await ensureMonetizationTables();
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select count(distinct user_id)::int as n from subscriptions
     where status = 'active' and expires_at > now()`,
  );
  return rows[0]?.n ?? 0;
}

export async function listMonetizationLogRows(): Promise<MonetizationLogRow[]> {
  await ensureMonetizationTables();
  const sql = await getSql();
  return sql.query<MonetizationLogRow>(
    `select l.id, l.admin_id, l.from_mode, l.to_mode, l.monthly_price_mdl, l.free_job_limit,
            l.free_apply_limit, l.note, l.created_at,
            coalesce(nullif(trim(u.name), ''), u.email, l.admin_id) as admin_name
     from monetization_log l
     left join "user" u on u.id = l.admin_id
     order by l.created_at desc
     limit 40`,
  );
}

export async function listProSubscribers(): Promise<ProSubscriber[]> {
  await ensureMonetizationTables();
  const sql = await getSql();
  return sql.query<ProSubscriber>(
    `select s.user_id, s.source, s.started_at, s.expires_at,
            coalesce(nullif(trim(u.name), ''), u.email, s.user_id) as name,
            u.email
     from subscriptions s
     left join "user" u on u.id = s.user_id
     where s.status = 'active' and s.expires_at > now()
       and not exists (
         select 1 from subscriptions s2
         where s2.user_id = s.user_id
           and s2.status = 'active'
           and s2.expires_at > now()
           and s2.expires_at > s.expires_at
       )
     order by s.expires_at desc
     limit 80`,
  );
}
