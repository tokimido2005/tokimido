import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { assertPhoneFree, normalizePhone } from "@/lib/safety";

/** Whether the Telegram option should be offered at all (bot token configured). */
export const telegramAvailable = createServerFn({ method: "GET" }).handler(async () => {
  const { telegramEnabled } = await import("./telegram.server");
  return telegramEnabled();
});

/** Create a one-time link to the bot for verifying the account phone (or a new one). */
export const startTelegramVerify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        purpose: z.enum(["verify", "change"]).optional().default("verify"),
        phone: z.string().trim().max(20).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const tg = await import("./telegram.server");
    if (!tg.telegramEnabled()) throw new Error("tg.unavailable");
    const { assertRateLimit } = await import("./rate-limit.server");
    await assertRateLimit("tg_start", 20, 60);
    const { getSql } = await import("./db");
    const sql = await getSql();
    const rows = await sql.query<{ phone: string }>(`select coalesce(phone, '') as phone from profiles where user_id = $1`, [
      context.userId,
    ]);
    let target = rows[0]?.phone ?? "";
    if (data.purpose === "change") {
      target = normalizePhone(data.phone);
      if (target.replace(/\D/g, "").length < 8) throw new Error("sms.errPhone");
      await assertPhoneFree(target, context.userId);
    }
    if (!target) throw new Error("sms.errNeedPhone");
    void tg.ensureWebhook();
    const token = await tg.createVerifyToken(context.userId, data.purpose, target);
    const bot = await tg.botUsername();
    return { token, bot, url: `https://t.me/${bot}?start=${token}` };
  });

export const telegramVerifyStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ token: z.string().min(10).max(64) }).parse(d))
  .handler(async ({ context, data }) => {
    const { tokenStatus } = await import("./telegram.server");
    return tokenStatus(context.userId, data.token);
  });

/** After a mismatch: verify with the number Telegram reported instead. */
export const acceptTelegramPhone = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ token: z.string().min(10).max(64) }).parse(d))
  .handler(async ({ context, data }) => {
    const { acceptTelegramNumber } = await import("./telegram.server");
    const result = await acceptTelegramNumber(context.userId, data.token);
    if (result !== "done") throw new Error(result === "taken" ? "tg.taken" : "tg.expired");
    return { ok: true as const };
  });
