import { z } from "zod";

/** Shared (client + server) CV shape, validation and helpers. */

export const CV_LANGS = ["ro", "ru", "en", "fr", "de", "it", "uk", "tr", "es"] as const;
export const CV_LEVELS = ["basic", "medium", "fluent", "native"] as const;
export const CV_DRIVING = ["A", "B", "C", "CE", "D"] as const;
export const CV_EDU_LEVELS = ["gimnaziu", "liceu", "profesional", "colegiu", "licenta", "master", "doctorat"] as const;

/** Quick-pick skills (the user can type others too). */
export const CV_SKILL_SUGGESTIONS = [
  "Excel",
  "Word",
  "1C",
  "Casă de marcat",
  "Vânzări",
  "Lucru cu clienții",
  "Contabilitate",
  "Șofer",
  "Stivuitor",
  "Construcții",
  "Gătit",
  "Curățenie",
  "Îngrijire bătrâni",
  "Îngrijire copii",
  "Social media",
  "Programare",
  "Design",
  "Limbi străine",
  "Lucru în echipă",
  "Punctualitate",
];

const ym = z.string().regex(/^(\d{4}-\d{2})?$/);
const shortText = (n: number) => z.string().trim().max(n).default("");

export const cvExperienceSchema = z.object({
  company: shortText(100),
  role: shortText(100),
  from: ym.default(""),
  to: ym.default(""),
  current: z.boolean().default(false),
  description: shortText(800),
});

export const cvEducationSchema = z.object({
  school: shortText(140),
  field: shortText(100),
  level: z.enum(CV_EDU_LEVELS).or(z.literal("")).default(""),
  from: z.string().regex(/^(\d{4})?$/).default(""),
  to: z.string().regex(/^(\d{4})?$/).default(""),
});

export const cvLanguageSchema = z.object({
  lang: z.enum(CV_LANGS),
  level: z.enum(CV_LEVELS),
});

export const cvDataSchema = z.object({
  title: shortText(100),
  city: shortText(80),
  birthYear: z.string().regex(/^(\d{4})?$/).default(""),
  email: z.string().trim().max(120).default(""),
  about: shortText(1200),
  noExperience: z.boolean().default(false),
  experience: z.array(cvExperienceSchema).max(12).default([]),
  education: z.array(cvEducationSchema).max(8).default([]),
  languages: z.array(cvLanguageSchema).max(10).default([]),
  driving: z.array(z.enum(CV_DRIVING)).max(5).default([]),
  skills: z.array(z.string().trim().min(1).max(40)).max(25).default([]),
});

export type CvData = z.infer<typeof cvDataSchema>;
export type CvExperience = z.infer<typeof cvExperienceSchema>;
export type CvEducation = z.infer<typeof cvEducationSchema>;

export function emptyCv(): CvData {
  return cvDataSchema.parse({});
}

/** Parse anything (old saved JSON, partial objects) into a valid CV. */
export function normalizeCv(raw: unknown): CvData {
  const r = cvDataSchema.safeParse(raw ?? {});
  return r.success ? r.data : emptyCv();
}

/** Enough filled in to send to an employer. */
export function cvIsUsable(cv: CvData) {
  return Boolean(cv.title.trim()) && (cv.noExperience || cv.experience.some((e) => e.role || e.company));
}

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  if (!fy || !ty) return 0;
  return Math.max(0, (ty - fy) * 12 + ((tm || 1) - (fm || 1)) + 1);
}

function nowYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Total experience in years (rounded to .5) from the jobs listed. */
export function totalExperienceYears(cv: CvData) {
  if (cv.noExperience) return 0;
  const months = cv.experience.reduce(
    (sum, e) => sum + (e.from ? monthsBetween(e.from, e.current || !e.to ? nowYm() : e.to) : 0),
    0,
  );
  return Math.round((months / 12) * 2) / 2;
}

/** The most recent job (current first, then latest end date). */
export function lastJob(cv: CvData): CvExperience | null {
  if (cv.noExperience || cv.experience.length === 0) return null;
  const score = (e: CvExperience) => (e.current ? "9999-99" : e.to || e.from || "0000-00");
  return [...cv.experience].sort((a, b) => score(b).localeCompare(score(a)))[0] ?? null;
}

export function topEducation(cv: CvData): CvEducation | null {
  if (cv.education.length === 0) return null;
  const rank = (e: CvEducation) => (e.level ? CV_EDU_LEVELS.indexOf(e.level) : -1);
  return [...cv.education].sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

export function ageFromBirthYear(y: string) {
  const n = Number(y);
  if (!n) return null;
  const age = new Date().getFullYear() - n;
  return age > 10 && age < 100 ? age : null;
}

/* ---------- Structured "angajare" listing ---------- */

export const JOB_EXPERIENCE = ["none", "1", "3", "5"] as const;
export const JOB_EDUCATION = ["any", "medii", "profesional", "superior"] as const;

export const jobDetailsSchema = z.object({
  responsibilities: shortText(2000),
  requirements: shortText(2000),
  offer: shortText(2000),
  experience: z.enum(JOB_EXPERIENCE).or(z.literal("")).default(""),
  education: z.enum(JOB_EDUCATION).or(z.literal("")).default(""),
  languages: z.array(z.enum(CV_LANGS)).max(6).default([]),
  salary_max: z.number().int().min(0).max(1_000_000).default(0),
  address: shortText(160),
  hr_name: shortText(80),
});

export type JobDetails = z.infer<typeof jobDetailsSchema>;

export function normalizeJobDetails(raw: unknown): JobDetails {
  const r = jobDetailsSchema.safeParse(raw ?? {});
  return r.success ? r.data : jobDetailsSchema.parse({});
}

/** Split a free-text block into bullet lines ("- x", "• x" or one per line). */
export function bulletLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*([-•*–]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}
