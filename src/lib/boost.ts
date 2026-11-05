import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const BOOST_TIERS = ["standard", "rapid", "urgent"] as const;
export type BoostTier = (typeof BOOST_TIERS)[number];

export type BoostPackage = {
  id: BoostTier;
  price: number;
  hours: number;
};

export const BOOST_PACKAGES: BoostPackage[] = [
  { id: "standard", price: 8, hours: 24 },
  { id: "rapid", price: 15, hours: 48 },
  { id: "urgent", price: 30, hours: 24 * 5 },
];

export function boostPackage(tier: string): BoostPackage | null {
  return BOOST_PACKAGES.find((p) => p.id === tier) ?? null;
}

export function isBoostActive(job: { boost_tier?: string | null; boost_until?: string | null }) {
  const tier = job.boost_tier ?? "";
  if (!boostPackage(tier) || !job.boost_until) return false;
  const t = new Date(job.boost_until).getTime();
  return Number.isFinite(t) && t > Date.now();
}

export function activeBoostTier(job: { boost_tier?: string | null; boost_until?: string | null }): BoostTier | null {
  if (!isBoostActive(job)) return null;
  const tier = job.boost_tier ?? "";
  return boostPackage(tier) ? (tier as BoostTier) : null;
}

export type BoostResult = {
  jobId: number;
  tier: BoostTier;
  price: number;
  until: string;
};

const buySchema = z.object({
  jobId: z.number().int().positive(),
  tier: z.enum(BOOST_TIERS),
});

export const purchaseBoost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => buySchema.parse(d))
  .handler(async ({ context, data }) => {
    const { assertNotBanned } = await import("./admin.server");
    await assertNotBanned(context.userId);
    const { readSettings } = await import("./monetization.server");
    if ((await readSettings()).mode !== "free") {
      throw new Error("Plata online nu este încă disponibilă. Contactează-ne pentru promovare.");
    }
    const { applyBoost } = await import("./boost.server");
    return applyBoost(context.userId, data.jobId, data.tier) as Promise<BoostResult>;
  });
