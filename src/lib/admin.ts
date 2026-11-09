import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

function inboxPath(messageId?: number) {
  return messageId ? `/cont?tab=inbox&msg=${messageId}` : "/cont?tab=inbox";
}
export const primeAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { ensureAdminUser } = await import("./admin.server");
  await ensureAdminUser();
  return { ok: true as const };
});

export const getAdminSession = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { ensureAdminUser, isAdminId } = await import("./admin.server");
    await ensureAdminUser();
    return { admin: await isAdminId(context.userId) };
  });

export type AdminStats = {
  users: number;
  activeJobs: number;
  expiredJobs: number;
  cancelledJobs: number;
  pendingReports: number;
  bannedUsers: number;
  moneyMode: "free" | "freemium" | "paid";
  moneyPrice: number;
  freeJobLimit: number;
  freeApplyLimit: number;
  proSubscribers: number;
  demoJobs: number;
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    const { readSettings, countActivePros } = await import("./monetization.server");
    const { countDemoJobs } = await import("./demo-jobs.server");
    const [users, active, expired, cancelled, reports, banned, money, proSubscribers, demoJobs] = await Promise.all([
      sql.query<{ n: number }>(`select count(*)::int as n from "user"`),
      sql.query<{ n: number }>(
        `select count(*)::int as n from jobs where status = 'open' and coalesce(hidden, false) = false`,
      ),
      sql.query<{ n: number }>(`select count(*)::int as n from jobs where status = 'expired'`),
      sql.query<{ n: number }>(`select count(*)::int as n from jobs where status = 'cancelled'`),
      sql.query<{ n: number }>(`select count(*)::int as n from reports where status = 'pending'`),
      sql.query<{ n: number }>(
        `select count(*)::int as n from profiles
         where banned_at is not null and (banned_until is null or banned_until > now())`,
      ),
      readSettings(),
      countActivePros(),
      countDemoJobs(),
    ]);
    return {
      users: users[0]?.n ?? 0,
      activeJobs: active[0]?.n ?? 0,
      expiredJobs: expired[0]?.n ?? 0,
      cancelledJobs: cancelled[0]?.n ?? 0,
      pendingReports: reports[0]?.n ?? 0,
      bannedUsers: banned[0]?.n ?? 0,
      moneyMode: money.mode,
      moneyPrice: money.monthlyPriceMdl,
      freeJobLimit: money.freeJobLimit,
      freeApplyLimit: money.freeApplyLimit,
      proSubscribers,
      demoJobs,
    } satisfies AdminStats;
  });

export type AdminJob = {
  id: number;
  user_id: string;
  title: string;
  category: string;
  raion: string;
  locality: string;
  status: string;
  hidden: boolean;
  is_demo: boolean;
  poster_name: string;
  created_at: string;
  starts_at: string | null;
};

export const listAdminJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ q: z.string().trim().max(80).optional().default(""), status: z.string().optional().default("") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { ensureDemoJobColumn } = await import("./demo-jobs.server");
    await ensureDemoJobColumn();
    const sql = await getSql();
    const conditions: string[] = ["true"];
    const params: unknown[] = [];
    let i = 1;
    if (data.q) {
      conditions.push(
        `(j.title ilike $${i} or j.poster_name ilike $${i} or j.raion ilike $${i} or j.locality ilike $${i})`,
      );
      params.push(`%${data.q}%`);
      i += 1;
    }
    if (data.status && data.status !== "all") {
      if (data.status === "hidden") conditions.push("j.hidden = true");
      else if (data.status === "demo") conditions.push("coalesce(j.is_demo, false) = true");
      else {
        conditions.push(`j.status = $${i++}`);
        params.push(data.status);
      }
    }
    return sql.query<AdminJob>(
      `select j.id, j.user_id, j.title, j.category, j.raion, j.locality, j.status,
              coalesce(j.hidden, false) as hidden, coalesce(j.is_demo, false) as is_demo,
              j.poster_name, j.created_at, j.starts_at
       from jobs j
       where ${conditions.join(" and ")}
       order by j.created_at desc
       limit 80`,
      params,
    );
  });

export const adminDeleteJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: number) => id)
  .handler(async ({ context, data: id }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{ title: string }>("delete from jobs where id = $1 returning title", [id]);
    if (!rows[0]) throw new Error("Anunțul nu există");
    await logAdminAction(context.userId, "job.delete", "job", String(id), rows[0].title);
    return { ok: true as const };
  });

export const adminHideJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ id: z.number().int(), hidden: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{ title: string }>(
      "update jobs set hidden = $1 where id = $2 returning title",
      [data.hidden, data.id],
    );
    if (!rows[0]) throw new Error("Anunțul nu există");
    await logAdminAction(
      context.userId,
      data.hidden ? "job.hide" : "job.unhide",
      "job",
      String(data.id),
      rows[0].title,
    );
    return { ok: true as const };
  });

export const generateDemoJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(() => ({}))
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const demo = await import("./demo-jobs.server");
    return demo.generateDemoJobs(context.userId);
  });

export const deleteDemoJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(() => ({}))
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const demo = await import("./demo-jobs.server");
    return demo.deleteDemoJobs(context.userId);
  });

export type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: string;
  banned_at: string | null;
  banned_until: string | null;
  ban_reason: string;
  created_at: string | null;
  jobs_count: number;
  warnings_count: number;
  pro_until: string | null;
};

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((q: string) => q)
  .handler(async ({ context, data: q }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { ensureMonetizationTables } = await import("./monetization.server");
    await ensureMonetizationTables();
    const sql = await getSql();
    const query = q.trim();
    const params: unknown[] = [];
    let where = "true";
    if (query) {
      params.push(`%${query}%`);
      where = `(u.name ilike $1 or u.email ilike $1 or coalesce(p.phone,'') ilike $1 or coalesce(p.first_name,'') ilike $1 or coalesce(p.last_name,'') ilike $1)`;
    }
    return sql.query<AdminUser>(
      `select u.id, u.name, u.email, coalesce(p.phone,'') as phone, coalesce(p.role,'user') as role,
              p.banned_at, p.banned_until, coalesce(p.ban_reason,'') as ban_reason, u."createdAt" as created_at,
              (select count(*)::int from jobs j where j.user_id = u.id) as jobs_count,
              (select count(*)::int from user_warnings w where w.user_id = u.id) as warnings_count,
              (select max(s.expires_at) from subscriptions s
                where s.user_id = u.id and s.status = 'active' and s.expires_at > now()) as pro_until
       from "user" u
       left join profiles p on p.user_id = u.id
       where ${where}
       order by u."createdAt" desc
       limit 60`,
      params,
    );
  });

const banSchema = z.object({
  userId: z.string().min(1),
  days: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7), z.literal(30)]),
  reason: z.string().trim().min(8).max(200),
});

export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => banSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdmin, ADMIN_USER_ID, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Nu poți bloca contul de admin");
    if (data.userId === ADMIN_USER_ID) throw new Error("Nu poți bloca adminul");
    const sql = await getSql();
    await sql.query(`
      create table if not exists user_warnings (
        id serial primary key,
        user_id text not null,
        admin_id text not null,
        reason text not null,
        created_at timestamptz not null default now()
      )
    `);
    const warned = await sql.query<{ n: number }>(
      "select count(*)::int as n from user_warnings where user_id = $1",
      [data.userId],
    );
    if ((warned[0]?.n ?? 0) < 1) {
      throw new Error("Trimite întâi un avertisment înainte de blocare.");
    }
    const until = data.days === 0 ? null : new Date(Date.now() + data.days * 24 * 60 * 60 * 1000).toISOString();
    const reason = data.reason.trim();
    await sql.query(
      `insert into profiles (user_id, banned_at, banned_until, ban_reason, accepted_rules_at)
       values ($1, now(), $2, $3, now())
       on conflict (user_id) do update set
         banned_at = now(), banned_until = excluded.banned_until, ban_reason = excluded.ban_reason`,
      [data.userId, until, reason],
    );
    const label = data.days === 0 ? "permanent" : `${data.days}d`;
    await logAdminAction(
      context.userId,
      data.days === 0 ? "user.ban.permanent" : `user.ban.${data.days}d`,
      "user",
      data.userId,
      `${label} | ${reason}`,
    );
    const title = data.days === 0 ? "Cont blocat permanent" : "Cont temporar suspendat";
    await sql.query(
      `insert into admin_messages (admin_id, user_id, title, body) values ($1, $2, $3, $4)`,
      [context.userId, data.userId, title, reason],
    );
    try {
      const { notifyUser } = await import("./push.server");
      await notifyUser(data.userId, { title, body: reason, url: "/" });
    } catch (err) {
      console.error("[admin] ban push", err);
    }
    return { ok: true as const };
  });

export const adminUnbanUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql.query(
      `update profiles set banned_at = null, banned_until = null, ban_reason = '' where user_id = $1`,
      [userId],
    );
    await logAdminAction(context.userId, "user.unban", "user", userId, "");
    return { ok: true as const };
  });

export const adminWarnUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ userId: z.string().min(1), reason: z.string().trim().min(4).max(300) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin, ADMIN_USER_ID, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    if (data.userId === ADMIN_USER_ID) throw new Error("Nu poți avertiza adminul");
    const sql = await getSql();
    await sql.query(`
      create table if not exists user_warnings (
        id serial primary key,
        user_id text not null,
        admin_id text not null,
        reason text not null,
        created_at timestamptz not null default now()
      )
    `);
    await sql.query(
      "insert into user_warnings (user_id, admin_id, reason) values ($1, $2, $3)",
      [data.userId, context.userId, data.reason],
    );
    await logAdminAction(context.userId, "user.warn", "user", data.userId, data.reason);
    const inserted = await sql.query<{ id: number }>(
      `insert into admin_messages (admin_id, user_id, title, body)
       values ($1, $2, $3, $4) returning id`,
      [context.userId, data.userId, "Avertisment", data.reason],
    );
    try {
      const { notifyUser } = await import("./push.server");
      await notifyUser(data.userId, {
        title: "Avertisment",
        body: data.reason,
        url: inboxPath(inserted[0]?.id),
      });
    } catch (err) {
      console.error("[admin] warn push", err);
    }
    return { ok: true as const };
  });

export type AdminUserDetail = {
  user: AdminUser;
  jobs: Array<{ id: number; title: string; status: string; created_at: string }>;
  ratings: Array<{ stars: number; comment: string; created_at: string }>;
  reports: Array<{ id: number; reason: string; status: string; created_at: string; target_type: string }>;
};

export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { ensureMonetizationTables } = await import("./monetization.server");
    await ensureMonetizationTables();
    const sql = await getSql();
    const users = await sql.query<AdminUser>(
      `select u.id, u.name, u.email, coalesce(p.phone,'') as phone, coalesce(p.role,'user') as role,
              p.banned_at, p.banned_until, coalesce(p.ban_reason,'') as ban_reason, u."createdAt" as created_at,
              (select count(*)::int from jobs j where j.user_id = u.id) as jobs_count,
              (select count(*)::int from user_warnings w where w.user_id = u.id) as warnings_count,
              (select max(s.expires_at) from subscriptions s
                where s.user_id = u.id and s.status = 'active' and s.expires_at > now()) as pro_until
       from "user" u
       left join profiles p on p.user_id = u.id
       where u.id = $1`,
      [userId],
    );
    if (!users[0]) throw new Error("Utilizatorul nu există");
    const [jobs, ratings, reports] = await Promise.all([
      sql.query<{ id: number; title: string; status: string; created_at: string }>(
        `select id, title, status, created_at from jobs where user_id = $1 order by created_at desc limit 20`,
        [userId],
      ),
      sql.query<{ stars: number; comment: string; created_at: string }>(
        `select stars, comment, created_at from ratings where to_user_id = $1 order by created_at desc limit 20`,
        [userId],
      ),
      sql.query<{ id: number; reason: string; status: string; created_at: string; target_type: string }>(
        `select id, reason, status, created_at, target_type from reports
         where reporter_id = $1 or (target_type = 'user' and target_id = $1)
         order by created_at desc limit 20`,
        [userId],
      ),
    ]);
    return { user: users[0], jobs, ratings, reports } satisfies AdminUserDetail;
  });

export type AdminReport = {
  id: number;
  reporter_id: string;
  reporter_name: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
};

export const listAdminReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql.query<AdminReport>(
      `select r.id, r.reporter_id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
              coalesce(nullif(trim(both from concat_ws(' ', p.first_name, p.last_name)), ''), u.name, r.reporter_id) as reporter_name
       from reports r
       left join profiles p on p.user_id = r.reporter_id
       left join "user" u on u.id = r.reporter_id
       order by case when r.status = 'pending' then 0 else 1 end, r.created_at desc
       limit 80`,
    );
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        id: z.number().int(),
        status: z.enum(["reviewed", "dismissed"]),
        deleteJob: z.boolean().optional(),
        banUser: z.boolean().optional(),
        reason: z.string().trim().min(8).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql.query<AdminReport>(
      `select id, reporter_id, target_type, target_id, reason, details, status, created_at, '' as reporter_name
       from reports where id = $1`,
      [data.id],
    );
    const report = rows[0];
    if (!report) throw new Error("Raportul nu există");
    if (data.banUser) {
      let uid: string | null = report.target_type === "user" ? report.target_id : null;
      if (!uid && report.target_type === "job") {
        const jobs = await sql.query<{ user_id: string }>(`select user_id from jobs where id = $1`, [
          Number(report.target_id),
        ]);
        uid = jobs[0]?.user_id ?? null;
      }
      const reason = (data.reason ?? "").trim();
      if (reason.length < 8) {
        throw new Error("Alege sau scrie un motiv (minim 8 caractere).");
      }
      if (uid) {
        await sql.query(
          `insert into profiles (user_id, banned_at, banned_until, ban_reason, accepted_rules_at)
           values ($1, now(), now() + interval '7 days', $2, now())
           on conflict (user_id) do update set
             banned_at = now(), banned_until = now() + interval '7 days', ban_reason = excluded.ban_reason`,
          [uid, reason],
        );
        await sql.query(
          `insert into admin_messages (admin_id, user_id, title, body) values ($1, $2, $3, $4)`,
          [context.userId, uid, "Cont temporar suspendat", reason],
        );
        await logAdminAction(context.userId, "user.ban.7d", "user", uid, `7d | ${reason}`);
        try {
          const { notifyUser } = await import("./push.server");
          await notifyUser(uid, { title: "Cont temporar suspendat", body: reason, url: "/" });
        } catch (err) {
          console.error("[admin] report ban push", err);
        }
      }
    }
    if (data.deleteJob && report.target_type === "job") {
      await sql.query("delete from jobs where id = $1", [Number(report.target_id)]);
      await logAdminAction(context.userId, "report.delete_job", "job", report.target_id, `report #${data.id}`);
    }
    await sql.query(`update reports set status = $1 where id = $2`, [data.status, data.id]);
    await logAdminAction(context.userId, `report.${data.status}`, "report", String(data.id), report.reason);
    return { ok: true as const };
  });

export type SupportRow = {
  id: number;
  user_id: string | null;
  name: string;
  email: string;
  message: string;
  created_at: string;
};

export const listSupportMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    return sql.query<SupportRow>(
      `select id, user_id, name, email, message, created_at from support_messages order by created_at desc limit 80`,
    );
  });

export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        userId: z.string().min(1),
        title: z.string().trim().min(2).max(80),
        body: z.string().trim().min(4).max(800),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    const inserted = await sql.query<{ id: number }>(
      `insert into admin_messages (admin_id, user_id, title, body) values ($1, $2, $3, $4) returning id`,
      [context.userId, data.userId, data.title, data.body],
    );
    await logAdminAction(context.userId, "message.send", "user", data.userId, data.title);
    try {
      const { notifyUser } = await import("./push.server");
      await notifyUser(data.userId, {
        title: data.title,
        body: data.body,
        url: inboxPath(inserted[0]?.id),
      });
    } catch (err) {
      console.error("[admin] push", err);
    }
    return { ok: true as const, id: inserted[0]?.id ?? 0 };
  });

export type AdminLog = {
  id: number;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  details: string;
  created_at: string;
};

export const listAdminLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ filter: z.enum(["all", "bans", "messages", "money"]).optional().default("all") }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    let where = "true";
    if (data.filter === "bans") {
      where = `(action like 'user.ban%' or action in ('user.unban', 'report.ban_user'))`;
    } else if (data.filter === "messages") {
      where = `(action in ('message.send', 'user.warn'))`;
    } else if (data.filter === "money") {
      where = `(action like 'monetization.%' or action like 'subscription.%')`;
    }
    return sql.query<AdminLog>(
      `select a.id, a.admin_id, a.action, a.target_type, a.target_id, a.details, a.created_at,
              coalesce(nullif(trim(u.name), ''), u.email, a.target_id) as target_name
       from admin_actions a
       left join "user" u on u.id = a.target_id
       where ${where} order by a.created_at desc limit 150`,
    );
  });

export type InboxMessage = {
  id: number;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export const listMyInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { ensureAdminTables } = await import("./admin.server");
    await ensureAdminTables();
    const sql = await getSql();
    return sql.query<InboxMessage>(
      `select id, title, body, created_at, read_at from admin_messages
       where user_id = $1 order by created_at desc limit 30`,
      [context.userId],
    );
  });

export const markInboxRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { ensureAdminTables } = await import("./admin.server");
    await ensureAdminTables();
    const sql = await getSql();
    await sql.query(
      `update admin_messages set read_at = now() where user_id = $1 and read_at is null`,
      [context.userId],
    );
    return { ok: true as const };
  });

export type BanStatus = {
  banned: boolean;
  permanent: boolean;
  banned_at: string | null;
  banned_until: string | null;
  reason: string;
};

const clearBan: BanStatus = {
  banned: false,
  permanent: false,
  banned_at: null,
  banned_until: null,
  reason: "",
};

export const getMyBanStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { ensureAdminTables, isAdminId } = await import("./admin.server");
    await ensureAdminTables();
    if (await isAdminId(context.userId)) return clearBan;
    const sql = await getSql();
    const rows = await sql.query<{
      banned_at: string | null;
      banned_until: string | null;
      ban_reason: string;
    }>(`select banned_at, banned_until, ban_reason from profiles where user_id = $1`, [context.userId]);
    const row = rows[0];
    if (!row?.banned_at) return clearBan;
    if (row.banned_until && new Date(row.banned_until).getTime() <= Date.now()) {
      await sql.query(
        `update profiles set banned_at = null, banned_until = null, ban_reason = '' where user_id = $1`,
        [context.userId],
      );
      return clearBan;
    }
    return {
      banned: true,
      permanent: !row.banned_until,
      banned_at: row.banned_at,
      banned_until: row.banned_until,
      reason: row.ban_reason ?? "",
    } satisfies BanStatus;
  });

export type SmsLogRow = {
  id: number;
  phone: string;
  user_id: string | null;
  ip: string;
  purpose: string;
  event: string;
  detail: string;
  created_at: string;
};

export const listSmsLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ q: z.string().trim().max(40).optional().default("") }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { ensureSmsTables } = await import("./sms.server");
    await ensureSmsTables();
    const sql = await getSql();
    const q = data.q.trim();
    const params: unknown[] = [];
    let where = "true";
    if (q) {
      params.push(`%${q}%`);
      where = `(phone ilike $1 or ip ilike $1 or purpose ilike $1 or event ilike $1 or detail ilike $1)`;
    }
    return sql.query<SmsLogRow>(
      `select id, phone, user_id, ip, purpose, event, detail, created_at
       from sms_log
       where ${where}
       order by created_at desc
       limit 150`,
      params,
    );
  });

export type VerifyStats = { days: number; telegram: number; sms: number; smsSent: number }[];

/** Telegram vs SMS verifications and SMS sent (cost), last 7 and 30 days. */
export const adminVerifyStats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<VerifyStats> => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { ensureSmsTables } = await import("./sms.server");
    await ensureSmsTables();
    const sql = await getSql();
    const out: VerifyStats = [];
    for (const days of [7, 30]) {
      const rows = await sql.query<{ telegram: number; sms: number; sent: number }>(
        `select count(*) filter (where event = 'tg_verify')::int as telegram,
                count(*) filter (where event = 'verify_ok')::int as sms,
                count(*) filter (where event = 'send')::int as sent
         from sms_log where created_at > now() - make_interval(days => $1)`,
        [days],
      );
      const r = rows[0] ?? { telegram: 0, sms: 0, sent: 0 };
      out.push({ days, telegram: r.telegram, sms: r.sms, smsSent: r.sent });
    }
    return out;
  });

/** How many accounts and listings a "delete all but admin" would remove. */
export const adminWipePreview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { wipePreview } = await import("./admin-wipe.server");
    return wipePreview();
  });

/** JSON backup (no passwords, sessions or photos) to download before the wipe. */
export const adminWipeBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { wipeBackup } = await import("./admin-wipe.server");
    const backup = await wipeBackup();
    await logAdminAction(context.userId, "users.backup", "system", "all", `${backup.users.length} users`);
    return JSON.stringify(backup, null, 2);
  });

export const WIPE_CONFIRM = "ȘTERGE TOT";

/** Delete every account except the admin(s). Irreversible. */
export const adminWipeUsers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ confirm: z.string().max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const typed = data.confirm.trim().toUpperCase();
    if (typed !== WIPE_CONFIRM && typed !== "STERGE TOT") throw new Error("Scrie exact: ȘTERGE TOT");
    const { wipeAllButAdmin } = await import("./admin-wipe.server");
    const result = await wipeAllButAdmin();
    await logAdminAction(
      context.userId,
      "users.wipe",
      "system",
      "all",
      `Șterse ${result.deletedUsers} conturi (toate în afară de admin)`,
    );
    return result;
  });
