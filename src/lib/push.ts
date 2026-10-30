import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { FIREBASE_VAPID_KEY } from "@/lib/firebase-config";

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { publicPushKey } = await import("./push.server");
  return {
    publicKey: FIREBASE_VAPID_KEY,
    webPushPublicKey: await publicPushKey(),
  };
});

const deviceSchema = z.object({
  token: z.string().trim().min(8).max(4096),
  endpoint: z.string().trim().max(2048).optional().default(""),
  p256dh: z.string().trim().max(512).optional().default(""),
  auth: z.string().trim().max(256).optional().default(""),
});

export const savePushDevice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => deviceSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { ensurePushTables } = await import("./push.server");
    await ensurePushTables();
    const sql = await getSql();
    const endpoint = data.endpoint || data.token;
    await sql.query(
      `insert into push_devices (user_id, token, endpoint, p256dh, auth, last_seen_at)
       values ($1, $2, $3, $4, $5, now())
       on conflict (user_id, token) do update set
         endpoint = excluded.endpoint,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         last_seen_at = now()`,
      [context.userId, data.token, endpoint, data.p256dh ?? "", data.auth ?? ""],
    );
    await sql.query(
      `insert into profiles (user_id, fcm_token, notify_push, accepted_rules_at)
       values ($1, $2, true, now())
       on conflict (user_id) do update set fcm_token = excluded.fcm_token, notify_push = true`,
      [context.userId, data.token],
    );
    return { ok: true as const };
  });

export const clearPushDevice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ token: z.string().min(1).max(4096) }).parse(d))
  .handler(async ({ context, data }) => {
    const { ensurePushTables } = await import("./push.server");
    await ensurePushTables();
    const sql = await getSql();
    await sql.query("delete from push_devices where user_id = $1 and token = $2", [
      context.userId,
      data.token,
    ]);
    return { ok: true as const };
  });

const prefsSchema = z.object({
  notify_raion: z.string().trim().max(80).optional(),
  notify_push: z.boolean().optional(),
  notify_email: z.boolean().optional(),
  notify_category: z.string().trim().max(40).optional(),
});

export const updatePushPrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => prefsSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { ensurePushTables } = await import("./push.server");
    await ensurePushTables();
    const sql = await getSql();
    await sql.query(
      `insert into profiles (user_id, accepted_rules_at) values ($1, now())
       on conflict (user_id) do nothing`,
      [context.userId],
    );
    if (data.notify_raion !== undefined) {
      await sql.query("update profiles set notify_raion = $1 where user_id = $2", [
        data.notify_raion,
        context.userId,
      ]);
    }
    if (data.notify_push !== undefined) {
      await sql.query("update profiles set notify_push = $1 where user_id = $2", [
        data.notify_push,
        context.userId,
      ]);
    }
    if (data.notify_email !== undefined) {
      await sql.query(
        "alter table profiles add column if not exists notify_email boolean not null default true",
      );
      await sql.query("update profiles set notify_email = $1 where user_id = $2", [
        data.notify_email,
        context.userId,
      ]);
    }
    if (data.notify_category !== undefined) {
      await sql.query(
        "alter table profiles add column if not exists notify_category text not null default ''",
      );
      await sql.query("update profiles set notify_category = $1 where user_id = $2", [
        data.notify_category,
        context.userId,
      ]);
    }
    const rows = await sql.query<{
      notify_raion: string;
      notify_push: boolean;
      fcm_token: string | null;
      notify_email: boolean;
      notify_category: string;
    }>(
      `select notify_raion, notify_push, fcm_token,
              coalesce(notify_email, true) as notify_email,
              coalesce(notify_category,'') as notify_category
       from profiles where user_id = $1`,
      [context.userId],
    );
    return (
      rows[0] ?? {
        notify_raion: "",
        notify_push: true,
        fcm_token: null,
        notify_email: true,
        notify_category: "",
      }
    );
  });
