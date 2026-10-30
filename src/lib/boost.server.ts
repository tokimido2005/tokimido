import "@tanstack/react-start/server-only";
import { getSql } from "@/lib/db";
import { BOOST_PACKAGES, type BoostResult, type BoostTier } from "@/lib/boost";

export async function applyBoost(userId: string, jobId: number, tier: BoostTier): Promise<BoostResult> {
  const pack = BOOST_PACKAGES.find((p) => p.id === tier);
  if (!pack) throw new Error("Pachet invalid");
  const sql = await getSql();
  const jobs = await sql.query<{
    id: number;
    user_id: string;
    title: string;
    raion: string;
    category: string;
    status: string;
  }>(
    `select id, user_id, title, raion, category, status from jobs
     where id = $1 and coalesce(hidden, false) = false`,
    [jobId],
  );
  const job = jobs[0];
  if (!job) throw new Error("Anunțul nu există");
  if (job.user_id !== userId) throw new Error("Poți promova doar anunțurile tale");
  if (job.status !== "open") throw new Error("Anunțul nu mai este deschis");

  const updated = await sql.query<{ boost_until: string | Date }>(
    `update jobs
     set boost_tier = $1,
         boost_until = now() + ($2::int * interval '1 hour')
     where id = $3 and user_id = $4
     returning boost_until`,
    [pack.id, pack.hours, jobId, userId],
  );
  const rawUntil = updated[0]?.boost_until;
  const untilDate = rawUntil instanceof Date ? rawUntil : new Date(String(rawUntil ?? ""));
  if (!rawUntil || Number.isNaN(untilDate.getTime())) throw new Error("Nu am putut aplica boost-ul");
  const until = untilDate.toISOString();

  await sql.query(
    `insert into job_boosts (job_id, user_id, tier, price_mdl, ends_at)
     values ($1, $2, $3, $4, $5)`,
    [jobId, userId, pack.id, pack.price, until],
  );

  if (pack.id === "rapid" || pack.id === "urgent") {
    const { notifyNewJobInRaion } = await import("./push.server");
    await notifyNewJobInRaion({
      raion: job.raion,
      title: job.title,
      jobId,
      exceptUserId: userId,
      category: job.category,
      headline: pack.id === "urgent" ? `Urgent: ${job.title}` : `Anunț promovat: ${job.title}`,
      priority: pack.id === "urgent",
    });
  }

  return { jobId, tier: pack.id, price: pack.price, until };
}
