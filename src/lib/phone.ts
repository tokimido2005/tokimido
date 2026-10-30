import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureProfilesTable } from "@/lib/profile";
import { assertPhoneFree, normalizePhone } from "@/lib/safety";
import { getSql } from "@/lib/db";

const phoneSchema = z.string().trim().min(8).max(20);
const codeSchema = z.string().trim().min(6).max(6);

export { normalizePhone };
export { formatSmsError } from "@/lib/sms-errors";

export function formatPhoneDisplay(phone: string) {
  const n = phone.replace(/\D/g, "");
  if (n.length === 9 && n.startsWith("0")) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  if (n.length === 8) return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
  return phone;
}

async function accountPhone(userId: string) {
  await ensureProfilesTable();
  const sql = await getSql();
  const rows = await sql.query<{ phone: string; phone_verified_at: string | null }>(
    `select coalesce(phone,'') as phone, phone_verified_at from profiles where user_id = $1`,
    [userId],
  );
  return rows[0] ?? { phone: "", phone_verified_at: null };
}

export const sendPhoneCode = createServerFn({ method: "POST" })
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
    const { sendSmsCode } = await import("./sms.server");
    const row = await accountPhone(context.userId);
    if (data.purpose === "change") {
      const next = normalizePhone(data.phone || "");
      if (next.replace(/\D/g, "").length < 8) throw new Error("sms.errPhone");
      if (row.phone && next === row.phone && row.phone_verified_at) {
        throw new Error("sms.errSame");
      }
      await assertPhoneFree(next, context.userId);
      return sendSmsCode({ phone: next, purpose: "change", userId: context.userId });
    }
    const phone = row.phone || normalizePhone(data.phone || "");
    if (phone.replace(/\D/g, "").length < 8) {
      throw new Error("sms.errNeedPhone");
    }
    return sendSmsCode({ phone, purpose: "verify", userId: context.userId });
  });

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        purpose: z.enum(["verify", "change"]).optional().default("verify"),
        phone: phoneSchema.optional().default(""),
        code: codeSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { verifySmsCode, markPhoneVerified } = await import("./sms.server");
    const row = await accountPhone(context.userId);
    const phone =
      data.purpose === "change" ? normalizePhone(data.phone) : row.phone || normalizePhone(data.phone);
    await verifySmsCode({
      phone,
      purpose: data.purpose,
      code: data.code,
      userId: context.userId,
    });
    if (data.purpose === "change") {
      await assertPhoneFree(phone, context.userId);
    }
    await markPhoneVerified(context.userId, phone);
    return { ok: true as const, phone };
  });

export const sendResetCode = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ phone: phoneSchema }).parse(d))
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./auth/isolation.server");
    assertSameSiteRequest();
    const { sendSmsCode, findUserIdByPhone, noteLookupMiss } = await import("./sms.server");
    const phone = normalizePhone(data.phone);
    const userId = await findUserIdByPhone(phone);
    if (!userId) {
      await noteLookupMiss(phone, "reset");
      throw new Error("sms.errNoAccount");
    }
    return sendSmsCode({ phone, purpose: "reset", userId });
  });

export const verifyResetCode = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ phone: phoneSchema, code: codeSchema }).parse(d))
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./auth/isolation.server");
    assertSameSiteRequest();
    const { verifySmsCode } = await import("./sms.server");
    const result = await verifySmsCode({
      phone: data.phone,
      purpose: "reset",
      code: data.code,
    });
    if (!result.ticket) throw new Error("sms.errTicket");
    return { ok: true as const, ticket: result.ticket };
  });

export const setPasswordWithSms = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        phone: phoneSchema,
        ticket: z.string().trim().min(16).max(80),
        password: z.string().min(8).max(80),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./auth/isolation.server");
    assertSameSiteRequest();
    const { consumeResetTicket } = await import("./sms.server");
    return consumeResetTicket({ phone: data.phone, ticket: data.ticket, password: data.password });
  });
