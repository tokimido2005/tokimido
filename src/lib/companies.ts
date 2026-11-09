import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "200+"] as const;

export type Company = {
  id: number;
  owner_id: string;
  slug: string;
  name: string;
  logo: string | null;
  description: string;
  city: string;
  website: string;
  size: string;
  verified: boolean;
  created_at: string;
};

const COMPANY_COLS = `id, owner_id, slug, name, logo, description, city, website, size,
  (verified_at is not null) as verified, created_at`;

export function slugify(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\b(srl|s\.r\.l|sa|s\.a|ii|i\.i)\b/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "firma"
  );
}

export const getMyCompany = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql.query<Company>(`select ${COMPANY_COLS} from companies where owner_id = $1`, [context.userId]);
    return rows[0] ?? null;
  });

const companySchema = z.object({
  name: z.string().trim().min(2).max(80),
  logo: z.string().max(180_000).nullable(),
  description: z.string().trim().max(2000).default(""),
  city: z.string().trim().max(80).default(""),
  website: z
    .string()
    .trim()
    .max(160)
    .default("")
    .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
    .refine((v) => v === "" || /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(v), "company.errWebsite"),
  size: z.enum(COMPANY_SIZES).or(z.literal("")).default(""),
});

export const saveMyCompany = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => companySchema.parse(d))
  .handler(async ({ context, data }) => {
    if (data.logo && !/^data:image\/(png|jpe?g|webp);base64,/i.test(data.logo)) throw new Error("company.errLogo");
    const { assertProfileActive } = await import("./profile");
    await assertProfileActive(context.userId);
    const sql = await getSql();
    const existing = await sql.query<{ id: number; slug: string; name: string; verified: boolean }>(
      `select id, slug, name, (verified_at is not null) as verified from companies where owner_id = $1`,
      [context.userId],
    );
    if (existing[0]) {
      // Renaming a verified company needs a new check by the admin.
      const renamed = existing[0].name.trim().toLowerCase() !== data.name.trim().toLowerCase();
      await sql.query(
        `update companies set name = $2, logo = $3, description = $4, city = $5, website = $6, size = $7,
                updated_at = now(), verified_at = case when $8 then null else verified_at end
         where owner_id = $1`,
        [context.userId, data.name, data.logo, data.description, data.city, data.website, data.size, renamed],
      );
      return { slug: existing[0].slug };
    }
    const base = slugify(data.name);
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const taken = await sql.query<{ id: number }>(`select id from companies where slug = $1`, [slug]);
      if (!taken[0]) break;
      slug = `${base}-${i}`;
    }
    await sql.query(
      `insert into companies (owner_id, slug, name, logo, description, city, website, size)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [context.userId, slug, data.name, data.logo, data.description, data.city, data.website, data.size],
    );
    return { slug };
  });

export type CompanyPage = {
  company: Company;
  rating: { avg: number; count: number };
  jobs: Array<{
    id: number;
    title: string;
    raion: string;
    locality: string;
    payment_mdl: number;
    kind: string;
    created_at: string;
    salary_max: number;
  }>;
};

export const getCompanyPage = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ slug: z.string().min(1).max(60) }).parse(d))
  .handler(async ({ data }): Promise<CompanyPage | null> => {
    const sql = await getSql();
    const rows = await sql.query<Company>(`select ${COMPANY_COLS} from companies where slug = $1`, [data.slug]);
    const company = rows[0];
    if (!company) return null;
    const { VISIBLE_RATING_SQL } = await import("./ratings");
    const [rating, jobs] = await Promise.all([
      sql.query<{ avg: number; count: number }>(
        `select coalesce(avg(r.stars)::float, 0) as avg, count(*)::int as count
         from ratings r where r.to_user_id = $1 and ${VISIBLE_RATING_SQL("r")}`,
        [company.owner_id],
      ),
      sql.query<CompanyPage["jobs"][number]>(
        `select id, title, raion, locality, payment_mdl, coalesce(kind, 'rapid') as kind, created_at,
                coalesce((details->>'salary_max')::int, 0) as salary_max
         from jobs
         where user_id = $1 and status = 'open' and coalesce(hidden, false) = false
         order by created_at desc limit 50`,
        [company.owner_id],
      ),
    ]);
    return { company, rating: rating[0] ?? { avg: 0, count: 0 }, jobs };
  });

/** Small card for the job page: name, logo, verified, link. */
export const getCompanyForOwner = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ ownerId: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<Pick<Company, "slug" | "name" | "logo" | "verified" | "city">>(
      `select slug, name, logo, city, (verified_at is not null) as verified from companies where owner_id = $1`,
      [data.ownerId],
    );
    return rows[0] ?? null;
  });

export const adminSetCompanyVerified = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ slug: z.string().min(1).max(60), verified: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { requireAdmin, logAdminAction } = await import("./admin.server");
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql.query(
      `update companies set verified_at = case when $2 then now() else null end where slug = $1`,
      [data.slug, data.verified],
    );
    await logAdminAction(context.userId, data.verified ? "company.verify" : "company.unverify", "company", data.slug, "");
    return { ok: true as const };
  });
