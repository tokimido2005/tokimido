import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type NotifyStatus = {
  telegram: boolean;
  push: number;
  hasAlert: boolean;
  telegramAvailable: boolean;
};

/** Which notification channels this account has turned on. */
export const getNotifyStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<NotifyStatus> => {
    const sql = await getSql();
    const one = async (q: string) => {
      try {
        const rows = await sql.query<{ n: number }>(q, [context.userId]);
        return rows[0]?.n ?? 0;
      } catch {
        return 0;
      }
    };
    const [tg, push, alert] = await Promise.all([
      one(`select count(*)::int as n from telegram_links where user_id = $1`),
      one(`select count(*)::int as n from push_devices where user_id = $1`),
      one(`select count(*)::int as n from job_alerts where user_id = $1`),
    ]);
    const { telegramEnabled } = await import("./telegram.server");
    return { telegram: tg > 0, push, hasAlert: alert > 0, telegramAvailable: telegramEnabled() };
  });
