import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";

export type MoneyMode = "free" | "freemium" | "paid";

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

export const getMonetizationPublic = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ t: z.number().optional() }).parse(d ?? {}))
  .handler(async () => {
    const { readSettings } = await import("./monetization.server");
    return readSettings() as Promise<MonetizationSettings>;
  });

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: unknown) => z.object({ t: z.number().optional() }).parse(d ?? {}))
  .handler(async ({ context }) => {
    const { getAccessFor } = await import("./monetization.server");
    return getAccessFor(context.userId) as Promise<MonetizationAccess>;
  });

const saveSchema = z.object({
  mode: z.enum(["free", "freemium", "paid"]),
  monthlyPriceMdl: z.number().int().min(1).max(5000),
  freeJobLimit: z.number().int().min(0).max(100),
  freeApplyLimit: z.number().int().min(0).max(200),
});

export const saveMonetization = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { writeSettings } = await import("./monetization.server");
    return writeSettings(context.userId, data) as Promise<MonetizationSettings>;
  });

export const listMonetizationLog = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { listMonetizationLogRows } = await import("./monetization.server");
    return listMonetizationLogRows() as Promise<MonetizationLogRow[]>;
  });

export const listProSubscribers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const m = await import("./monetization.server");
    return m.listProSubscribers() as Promise<ProSubscriber[]>;
  });

export const activatePro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { assertNotBanned } = await import("./admin.server");
    await assertNotBanned(context.userId);
    const { grantSubscription, getAccessFor, readSettings } = await import("./monetization.server");
    // No payment provider is wired yet: self-activation would hand out paid
    // access for free. Only allow it while the platform is fully free.
    const settings = await readSettings();
    if (settings.mode !== "free") {
      throw new Error("Plata online nu este încă disponibilă. Contactează-ne pentru Pro.");
    }
    await grantSubscription(context.userId, 30, "self");
    return getAccessFor(context.userId) as Promise<MonetizationAccess>;
  });

const grantSchema = z.object({
  userId: z.string().min(1),
  days: z.number().int().min(1).max(730),
});

export const adminGrantPro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => grantSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { grantSubscription, getAccessFor } = await import("./monetization.server");
    await grantSubscription(data.userId, data.days, "admin", context.userId);
    return getAccessFor(data.userId) as Promise<MonetizationAccess>;
  });

export const adminRevokePro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((userId: string) => userId)
  .handler(async ({ context, data: userId }) => {
    const { requireAdmin } = await import("./admin.server");
    await requireAdmin(context.userId);
    const { revokeSubscription, getAccessFor } = await import("./monetization.server");
    await revokeSubscription(userId, context.userId);
    return getAccessFor(userId) as Promise<MonetizationAccess>;
  });
