import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { CATEGORIES, isCategoryId } from "@/lib/categories";
import { isKnownRaion } from "@/lib/moldova";
import {
  isContractType,
  isJobKind,
  isOfficialCategory,
  isSchedule,
  jobKind,
  type JobKind,
} from "@/lib/job-kinds";
import { ensureRatingsTable, maybeSendRatingReminders, VISIBLE_RATING_SQL } from "@/lib/ratings";
import { ensureCommunityTables } from "@/lib/community";
import { assertCaptcha, captchaSchema } from "@/lib/captcha";
import { assertNotBlocked, blockedSetFor, ensureSafetyTables } from "@/lib/safety";
import { assertProfileActive, ensureProfilesTable } from "@/lib/profile";
import { normalizeJobGeo } from "@/lib/geo";
import { ADULT_AGE, HEAVY_CATEGORIES, MIN_AGE, ageFromYear } from "@/lib/age";
import { cvIsUsable, jobDetailsSchema, normalizeCv, normalizeJobDetails, type CvData, type JobDetails } from "@/lib/cv-shared";
import { once } from "@/lib/once";

async function accountContactPhone(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<{ phone: string }>(
    `select coalesce(phone,'') as phone from profiles where user_id = $1`,
    [userId],
  );
  const phone = rows[0]?.phone?.trim() ?? "";
  if (phone.length < 8) throw new Error("Verifică telefonul din cont pentru a continua.");
  return phone;
}

type PushPayload = { title: string; body: string; url: string; telegram?: boolean };

async function ensurePushTables() {
  const m = await import("./push.server");
  await m.ensurePushTables();
}

function notifyUser(userId: string, payload: PushPayload, except?: string) {
  void import("./push.server")
    .then((m) => m.notifyUser(userId, payload, except))
    .catch((err) => console.error("[push]", err));
}

function notifyUsers(userIds: string[], payload: PushPayload, except?: string) {
  void import("./push.server")
    .then((m) => m.notifyUsers(userIds, payload, except))
    .catch((err) => console.error("[push]", err));
}

function notifyNewJobInRaion(opts: { raion: string; title: string; jobId: number; exceptUserId: string; category?: string }) {
  void import("./push.server")
    .then((m) => m.notifyNewJobInRaion(opts))
    .catch((err) => console.error("[push]", err));
}


export type Job = {
  id: number;
  user_id: string;
  title: string;
  description: string;
  category: string;
  raion: string;
  locality: string;
  payment_mdl: number;
  duration_minutes: number;
  people_needed: number;
  contact_phone: string | null;
  poster_name: string;
  status: string;
  created_at: string;
  starts_at: string | null;
  application_count: number;
  selected_count: number;
  poster_rating_avg: number;
  poster_rating_count: number;
  poster_phone_verified: boolean;
  views_count: number;
  has_geo: boolean;
  kind: JobKind;
  company: string;
  contract_type: string;
  schedule: string;
  salary_period: string;
  boost_tier: string;
  boost_until: string | null;
  details?: JobDetails;
  adults_only?: boolean;
};

export type Application = {
  id: number;
  job_id: number;
  user_id: string;
  applicant_name: string;
  first_name: string;
  last_name: string;
  message: string;
  contact_phone: string | null;
  status: string;
  created_at: string;
  applicant_rating_avg?: number;
  applicant_rating_count?: number;
  cv_kind?: string;
  cv_snapshot?: CvData | null;
  cv_file_id?: number | null;
  email?: string;
  viewed_at?: string | null;
  interview_at?: string | null;
  interview_note?: string;
  employer_note?: string;
};

export type AppStatus = "pending" | "contacted" | "interview" | "selected" | "declined" | "withdrawn";

const SEED_USER = "seed-jobpeloc";

function seedUserId(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `seed-${slug || "user"}`;
}

const seedJobs: Array<
  Omit<
    Job,
    | "id"
    | "user_id"
    | "status"
    | "created_at"
    | "starts_at"
    | "application_count"
    | "selected_count"
    | "poster_rating_avg"
    | "poster_rating_count"
    | "poster_phone_verified"
    | "views_count"
    | "has_geo"
    | "kind"
    | "company"
    | "contract_type"
    | "schedule"
    | "salary_period"
    | "boost_tier"
    | "boost_until"
  > & {
    hoursAgo: number;
    startInDays?: number;
    startTime?: string;
  }
> = [
  {
    title: "Mutare apartament 2 camere",
    description:
      "Căutăm 2 persoane pentru mutarea mobilierului din Botanica pe Buiucani. Lift există la ambele adrese. Frigider, canapea, dulap, cutii. Lucrăm calm, fără grabă periculoasă.",
    category: "mutari",
    raion: "Chișinău",
    locality: "Botanica",
    payment_mdl: 800,
    duration_minutes: 240,
    people_needed: 2,
    contact_phone: "069123001",
    poster_name: "Andrei M.",
    hoursAgo: 2,
    startInDays: 3,
    startTime: "09:00",
  },
  {
    title: "Curățenie după renovare",
    description:
      "Apartament 3 camere după zugrăvit. Praf, pete de vopsea pe parchet, geamuri. Materiale de curățenie sunt pe loc. Experiență similară e un plus.",
    category: "curatenie",
    raion: "Chișinău",
    locality: "Buiucani",
    payment_mdl: 650,
    duration_minutes: 300,
    people_needed: 1,
    contact_phone: "069123002",
    poster_name: "Elena V.",
    hoursAgo: 4,
    startInDays: 2,
    startTime: "08:30",
  },
  {
    title: "Cosit iarbă și curățat curte",
    description:
      "Curte ~400 m². Cositoare există. De scos iarba tăiată și de aliniat bordurile. Plată imediat după verificare.",
    category: "gradinarit",
    raion: "Chișinău",
    locality: "Stăuceni",
    payment_mdl: 280,
    duration_minutes: 150,
    people_needed: 1,
    contact_phone: "069123003",
    poster_name: "Ion P.",
    hoursAgo: 5,
  },
  {
    title: "Ajutor la turnat placă de beton",
    description:
      "Avem nevoie de 3 oameni pentru turnat și nivelat o placă de ~30 m². Cofraj e gata. Lucrare de o zi, pauză de masă asigurată.",
    category: "constructii",
    raion: "Ialoveni",
    locality: "Ialoveni",
    payment_mdl: 1200,
    duration_minutes: 480,
    people_needed: 3,
    contact_phone: "069123004",
    poster_name: "Sergiu D.",
    hoursAgo: 7,
  },
  {
    title: "Transport frigidere la etajul 4",
    description:
      "Două frigidere de la magazin pînă în apartament, fără lift. Trebuie oameni puternici, cu grijă la ziduri și uși.",
    category: "mutari",
    raion: "Bălți",
    locality: "Bălți",
    payment_mdl: 500,
    duration_minutes: 180,
    people_needed: 2,
    contact_phone: "069123005",
    poster_name: "Mihai R.",
    hoursAgo: 8,
  },
  {
    title: "Spălat geamuri birou",
    description:
      "Birou 180 m², geamuri interioare și exterioare la parter. Soluții și unelte pe loc. Lucrare de dimineață, înainte de deschiderea oficiului.",
    category: "curatenie",
    raion: "Chișinău",
    locality: "Centru",
    payment_mdl: 420,
    duration_minutes: 180,
    people_needed: 2,
    contact_phone: "069123006",
    poster_name: "Office Clean",
    hoursAgo: 10,
  },
  {
    title: "Săpat șanț pentru țeavă de apă",
    description:
      "Șanț ~25 m, adîncime 70 cm, sol moale. Lopeți pe loc. Plată pe loc la finalul zilei.",
    category: "constructii",
    raion: "Orhei",
    locality: "Orhei",
    payment_mdl: 900,
    duration_minutes: 360,
    people_needed: 2,
    contact_phone: "069123007",
    poster_name: "Vasile C.",
    hoursAgo: 12,
  },
  {
    title: "Curățenie casă la țară",
    description:
      "Casă cu 4 odăi, după iarnă. Praf, geamuri, curte. Căutăm o persoană atentă, se poate lucra în ritm propriu.",
    category: "curatenie",
    raion: "Hîncești",
    locality: "Lăpușna",
    payment_mdl: 350,
    duration_minutes: 240,
    people_needed: 1,
    contact_phone: "069123008",
    poster_name: "Tatiana S.",
    hoursAgo: 14,
  },
  {
    title: "Mutare depozit mic",
    description:
      "Rafturi, cutii și 2 mese de lucru. Distanță scurtă în oraș. Camionul e al nostru, avem nevoie de mîini la încărcat/descărcat.",
    category: "mutari",
    raion: "Cahul",
    locality: "Cahul",
    payment_mdl: 1500,
    duration_minutes: 480,
    people_needed: 4,
    contact_phone: "069123009",
    poster_name: "Depozit Sud",
    hoursAgo: 16,
    startInDays: 5,
    startTime: "07:00",
  },
  {
    title: "Plantat pomi fructiferi",
    description:
      "20 de puieți, gropile sunt săpate. Trebuie plantat corect, udat și ancorat. Experiență de grădinărit e binevenită.",
    category: "gradinarit",
    raion: "Strășeni",
    locality: "Cojușna",
    payment_mdl: 400,
    duration_minutes: 180,
    people_needed: 2,
    contact_phone: "069123010",
    poster_name: "Lilian B.",
    hoursAgo: 18,
  },
  {
    title: "Demolare perete interior (gips-carton)",
    description:
      "Perete nenositor, ~8 m². Molozul se scoate la containerul din curte. Măști și saci sunt pregătite.",
    category: "constructii",
    raion: "Chișinău",
    locality: "Durlești",
    payment_mdl: 700,
    duration_minutes: 240,
    people_needed: 2,
    contact_phone: "069123011",
    poster_name: "Cristina N.",
    hoursAgo: 20,
  },
  {
    title: "Ridicare mobilă la etajul 5, fără lift",
    description:
      "Canapea colțar + dulap demontat. Scara e largă. Lucrăm sîmbătă dimineața.",
    category: "mutari",
    raion: "Chișinău",
    locality: "Rîșcani",
    payment_mdl: 450,
    duration_minutes: 120,
    people_needed: 3,
    contact_phone: "069123012",
    poster_name: "Oleg T.",
    hoursAgo: 22,
  },
  {
    title: "Cosit livadă",
    description:
      "Livadă de 0.4 ha. Cositoare cu fir. De ocolit puieții tineri. Apă și gustare pe loc.",
    category: "gradinarit",
    raion: "Ungheni",
    locality: "Sculeni",
    payment_mdl: 320,
    duration_minutes: 300,
    people_needed: 1,
    contact_phone: "069123013",
    poster_name: "Petru L.",
    hoursAgo: 26,
  },
  {
    title: "Curățenie după petrecere",
    description:
      "Casă de oaspeți, bucătărie + salon. Vase, podele, saci de gunoi. Începem de dimineață.",
    category: "curatenie",
    raion: "Chișinău",
    locality: "Cricova",
    payment_mdl: 280,
    duration_minutes: 120,
    people_needed: 1,
    contact_phone: "069123014",
    poster_name: "Ana G.",
    hoursAgo: 28,
  },
  {
    title: "Ajutor pe acoperiș — țiglă metalică",
    description:
      "Ridicare foi de țiglă și asistare meșter. Nu e nevoie de experiență de acoperișor, dar trebuie să nu-ți fie frică de înălțime. Echipament de siguranță se dă.",
    category: "constructii",
    raion: "Soroca",
    locality: "Soroca",
    payment_mdl: 1800,
    duration_minutes: 480,
    people_needed: 3,
    contact_phone: "069123015",
    poster_name: "Gheorghe A.",
    hoursAgo: 30,
    startInDays: 6,
    startTime: "07:30",
  },
  {
    title: "Mutare birou mic",
    description:
      "6 birouri, 2 dulapuri, calculatoare (le împachetăm noi). De la etajul 2 la etajul 1, aceeași clădire.",
    category: "mutari",
    raion: "Chișinău",
    locality: "Ciocana",
    payment_mdl: 650,
    duration_minutes: 180,
    people_needed: 2,
    contact_phone: "069123016",
    poster_name: "Studio Nord",
    hoursAgo: 34,
  },
  {
    title: "Întreținere grădină — sezon",
    description:
      "Plivit, udat, aranjat straturi de legume. O zi de lucru, posibil colaborare și săptămîna viitoare.",
    category: "gradinarit",
    raion: "UTA Găgăuzia",
    locality: "Comrat",
    payment_mdl: 500,
    duration_minutes: 360,
    people_needed: 1,
    contact_phone: "069123017",
    poster_name: "Maria K.",
    hoursAgo: 36,
  },
  {
    title: "Încărcat camion cu lemne",
    description:
      "Lemne tăiate, de încărcat în camion. Mănuși se dau. Lucrare scurtă, plată imediat.",
    category: "mutari",
    raion: "Edineț",
    locality: "Edineț",
    payment_mdl: 400,
    duration_minutes: 120,
    people_needed: 2,
    contact_phone: "069123018",
    poster_name: "Nicolae F.",
    hoursAgo: 40,
  },
  {
    title: "Vopsit gard metalic",
    description:
      "Gard 18 m. Curățat rugină ușoară + grund + vopsea. Materialele sunt cumpărate. Căutăm pe cineva cu mînă dreaptă.",
    category: "constructii",
    raion: "Căușeni",
    locality: "Căușeni",
    payment_mdl: 550,
    duration_minutes: 300,
    people_needed: 1,
    contact_phone: "069123019",
    poster_name: "Dumitru I.",
    hoursAgo: 44,
  },
  {
    title: "Curățenie scări de bloc",
    description:
      "4 etaje, spălat trepte și geamuri pe casa scării. Detergent și găleți pe loc.",
    category: "curatenie",
    raion: "Bălți",
    locality: "Bălți",
    payment_mdl: 220,
    duration_minutes: 90,
    people_needed: 1,
    contact_phone: "069123020",
    poster_name: "Asociația 12",
    hoursAgo: 46,
  },
  {
    title: "Ajutor la încărcat mobilă de salon",
    description:
      "Canapele și fotolii din magazin spre o casă în Durlești. Camion cu șofer e gata — avem nevoie de 2 încărcători.",
    category: "mutari",
    raion: "Chișinău",
    locality: "Durlești",
    payment_mdl: 380,
    duration_minutes: 90,
    people_needed: 2,
    contact_phone: "069123021",
    poster_name: "Mobilă Plus",
    hoursAgo: 3,
  },
  {
    title: "Tăiere crengi uscate",
    description:
      "Nuc bătrîn, crengi uscate la 3–4 m. Scară există. De strîns și de pus pe grămadă.",
    category: "gradinarit",
    raion: "Criuleni",
    locality: "Măgdăcești",
    payment_mdl: 300,
    duration_minutes: 150,
    people_needed: 1,
    contact_phone: "069123022",
    poster_name: "Vitalie Z.",
    hoursAgo: 9,
  },
  {
    title: "Ajutor la cumpărături și casă",
    description:
      "Cumpărături de la magazinul din sat, pus pe rafturi, puțină curățenie în bucătărie. 3–4 ore, ritm calm. Plata se dă pe loc.",
    category: "casnic",
    raion: "Orhei",
    locality: "Peresecina",
    payment_mdl: 250,
    duration_minutes: 210,
    people_needed: 1,
    contact_phone: "069123023",
    poster_name: "Nina R.",
    hoursAgo: 6,
  },
  {
    title: "Îngrijire bunică — după-amiază",
    description:
      "Companie, o plimbare scurtă în curte, ceai și medicamente la oră. Căutăm o persoană răbdătoare, 4 ore.",
    category: "casnic",
    raion: "Chișinău",
    locality: "Buiucani",
    payment_mdl: 300,
    duration_minutes: 240,
    people_needed: 1,
    contact_phone: "069123024",
    poster_name: "Alexandru M.",
    hoursAgo: 11,
  },
  {
    title: "Ajutor la eveniment — montat mese",
    description:
      "Montat 20 de mese și scaune pentru o nuntă în sală. Lucrare de seară, 3–4 ore. Apă și gustare pe loc.",
    category: "altele",
    raion: "Chișinău",
    locality: "Centru",
    payment_mdl: 350,
    duration_minutes: 210,
    people_needed: 3,
    contact_phone: "069123025",
    poster_name: "Evenimente M.",
    hoursAgo: 1,
    startInDays: 4,
    startTime: "16:00",
  },
];

async function insertSeedJob(
  sql: Awaited<ReturnType<typeof getSql>>,
  job: (typeof seedJobs)[number],
) {
  const created = new Date(Date.now() - job.hoursAgo * 3600 * 1000);
  const TIMES = ["08:00", "09:00", "10:30", "13:00", "14:00", "16:00", "18:00"];
  const time = job.startTime ?? TIMES[job.hoursAgo % TIMES.length];
  const days = job.startInDays ?? 1 + (job.hoursAgo % 8);
  const [hh, mm] = time.split(":").map(Number);
  const starts = new Date();
  starts.setDate(starts.getDate() + days);
  starts.setHours(hh || 9, mm || 0, 0, 0);
  const exists = await sql.query<{ id: number }>("select id from jobs where title = $1 limit 1", [job.title]);
  if (exists[0]) return;
  await sql.query(
    `insert into jobs (
      user_id, title, description, category, raion, locality,
      payment_mdl, duration_minutes, people_needed, contact_phone, poster_name, status, created_at, starts_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open',$12,$13)`,
    [
      seedUserId(job.poster_name),
      job.title,
      job.description,
      job.category,
      job.raion,
      job.locality,
      job.payment_mdl,
      job.duration_minutes,
      job.people_needed,
      job.contact_phone,
      job.poster_name,
      created.toISOString(),
      starts.toISOString(),
    ],
  );
}

const ensureApplicationNameColumns = once(ensureApplicationNameColumnsImpl);

async function ensureApplicationNameColumnsImpl() {
  const sql = await getSql();
  await sql.query(
    "alter table applications add column if not exists first_name text not null default ''",
  );
  await sql.query(
    "alter table applications add column if not exists last_name text not null default ''",
  );
}

const ensureJobScheduleColumns = once(ensureJobScheduleColumnsImpl);

async function ensureJobScheduleColumnsImpl() {
  const sql = await getSql();
  await sql.query("alter table jobs add column if not exists starts_at timestamptz");
  await sql.query("alter table jobs add column if not exists views_count integer not null default 0");
  await sql.query("alter table jobs add column if not exists geo_lat double precision");
  await sql.query("alter table jobs add column if not exists geo_lng double precision");
  await sql.query("alter table jobs add column if not exists is_demo boolean not null default false");
  await sql.query("alter table jobs add column if not exists kind text not null default 'rapid'");
  await sql.query("alter table jobs add column if not exists company text not null default ''");
  await sql.query("alter table jobs add column if not exists contract_type text not null default ''");
  await sql.query("alter table jobs add column if not exists schedule text not null default ''");
  await sql.query("alter table jobs add column if not exists salary_period text not null default 'spot'");
  await sql.query(
    "update jobs set starts_at = created_at + interval '2 days' where starts_at is null and coalesce(kind, 'rapid') = 'rapid'",
  );
}

let expireRanAt = 0;
let expireRunning: Promise<void> | null = null;

/** Mark past jobs expired — at most every 30 s, not on every request. */
function expireDueJobs(): Promise<void> {
  if (expireRunning) return expireRunning;
  if (Date.now() - expireRanAt < 30_000) return Promise.resolve();
  expireRanAt = Date.now();
  expireRunning = expireDueJobsNow().finally(() => {
    expireRunning = null;
  });
  return expireRunning;
}

let logsCleanedAt = 0;

/** Technical logs are kept only as long as needed for safety (see privacy policy). */
async function cleanupOldLogs() {
  if (Date.now() - logsCleanedAt < 6 * 60 * 60_000) return;
  logsCleanedAt = Date.now();
  const sql = await getSql();
  for (const q of [
    "delete from sms_log where created_at < now() - interval '180 days'",
    "delete from rate_limits where created_at < now() - interval '30 days'",
  ]) {
    try {
      await sql.query(q);
    } catch {
      /* table may not exist yet */
    }
  }
}

async function expireDueJobsNow() {
  const sql = await getSql();
  void cleanupOldLogs();
  await ensurePushTables();
  const newly = await sql.query<{ id: number; user_id: string; title: string }>(
    `update jobs
     set status = 'expired', expire_notified = true
     where status = 'open'
       and coalesce(kind, 'rapid') = 'rapid'
       and starts_at is not null
       and starts_at <= now()
     returning id, user_id, title`,
  );
  const pending = await sql.query<{ id: number; user_id: string; title: string }>(
    `update jobs
     set expire_notified = true
     where status = 'expired' and coalesce(expire_notified, false) = false
     returning id, user_id, title`,
  );
  const seen = new Set<number>();
  for (const job of [...newly, ...pending]) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    void notifyUser(job.user_id, {
      title: "Anunțul a expirat",
      body: `${job.title} nu mai acceptă aplicații.`,
      url: `/jobs/${job.id}`,
    });
  }
}

async function cleanupPublicListings(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql.query("delete from jobs where title = $1", ["Ajutor la depozit — tură de ieri"]);
  await sql.query("delete from jobs where poster_name in ('Rabotaem.md Demo', 'JobPeLoc Demo')");
  await sql.query(
    `delete from jobs a
     using jobs b
     where a.id > b.id
       and lower(trim(a.title)) = lower(trim(b.title))
       and coalesce(a.kind, 'rapid') = coalesce(b.kind, 'rapid')
       and coalesce(a.is_demo, false) = false
       and coalesce(b.is_demo, false) = false
       and (a.user_id = $1 or a.user_id like 'seed-%')`,
    [SEED_USER],
  );

  const seedRows = await sql.query<{ id: number; poster_name: string; contact_phone: string | null }>(
    `select id, poster_name, contact_phone from jobs
     where user_id = $1 or user_id like 'seed-%'`,
    [SEED_USER],
  );
  for (const row of seedRows) {
    await sql.query("update jobs set user_id = $1 where id = $2", [seedUserId(row.poster_name), row.id]);
  }

  const urgent = await sql.query<{ n: number }>(
    `select count(*)::int as n from jobs
     where (user_id like 'seed-%')
       and coalesce(kind, 'rapid') = 'rapid'
       and status = 'open'
       and starts_at > now()
       and starts_at <= now() + interval '24 hours'`,
  );
  if ((urgent[0]?.n ?? 0) > 2) {
    const rapid = await sql.query<{ id: number }>(
      `select id from jobs
       where user_id like 'seed-%' and coalesce(kind, 'rapid') = 'rapid' and status = 'open'
       order by id`,
    );
    for (let i = 0; i < rapid.length; i += 1) {
      const starts = new Date();
      if (i === 0) {
        starts.setHours(starts.getHours() + 8, 0, 0, 0);
      } else {
        starts.setDate(starts.getDate() + (1 + (i % 6)));
        starts.setHours(8 + (i % 9), i % 2 === 0 ? 0 : 30, 0, 0);
      }
      if (starts.getTime() <= Date.now()) {
        starts.setTime(Date.now() + 10 * 3600 * 1000);
      }
      await sql.query("update jobs set starts_at = $1 where id = $2", [starts.toISOString(), rapid[i].id]);
    }
  }

  await ensureProfilesTable();
  const posters = await sql.query<{ user_id: string; poster_name: string; contact_phone: string | null; id: number }>(
    `select distinct on (user_id) user_id, poster_name, contact_phone, id
     from jobs
     where user_id like 'seed-%'
     order by user_id, id`,
  );
  let i = 0;
  for (const poster of posters) {
    const phone = (poster.contact_phone || `06912${String(1000 + i).slice(-4)}`).replace(/\s/g, "");
    const parts = poster.poster_name.replace(/\./g, "").trim().split(/\s+/);
    const first = parts[0] || "Utilizator";
    const last = parts.slice(1).join(" ") || ".";
    const verified = i % 3 !== 2;
    try {
      await sql.query(
        `insert into profiles (user_id, first_name, last_name, phone, phone_verified_at, accepted_rules_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (user_id) do update set
           phone = excluded.phone,
           phone_verified_at = case when $6 then coalesce(profiles.phone_verified_at, now()) else profiles.phone_verified_at end`,
        [poster.user_id, first, last, phone, verified ? new Date().toISOString() : null, verified],
      );
    } catch {
      /* unique phone collisions are fine */
    }
    if (i % 2 === 0) {
      try {
        await sql.query(
          `insert into ratings (job_id, from_user_id, to_user_id, stars, comment)
           values ($1, $2, $3, $4, ''), ($1, $5, $3, $6, '')
           on conflict do nothing`,
          [
            poster.id,
            `seed-reviewer-${i}-a`,
            poster.user_id,
            5,
            `seed-reviewer-${i}-b`,
            i % 4 === 0 ? 5 : 4,
          ],
        );
      } catch {
        /* ignore */
      }
    }
    i += 1;
  }
}

let jobsReady = false;

/**
 * Invented sample listings (seed-* users, fake ratings and "verified phone"
 * badges) must never look like real ads to visitors. They are created only
 * outside production, or when SEED_DEMO_JOBS=1 is set explicitly.
 */
function sampleSeedEnabled() {
  if (process.env.SEED_DEMO_JOBS?.trim() === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Sample/demo rows stay out of public listings in production unless
 * SHOW_DEMO_JOBS=1. Admin views query the table directly and still see them.
 */
function sampleJobsVisible() {
  if (process.env.SHOW_DEMO_JOBS?.trim() === "1") return true;
  return process.env.NODE_ENV !== "production";
}

const HIDE_SAMPLE_JOBS_SQL = `(j.user_id not like 'seed-%' and j.user_id <> 'demo-rabotaem' and coalesce(j.is_demo, false) = false)`;

async function seedIfEmpty() {
  const sql = await getSql();
  if (jobsReady) {
    try {
      await expireDueJobs();
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await ensureApplicationNameColumns();
    await ensureJobScheduleColumns();
    await ensureRatingsTable();
    await ensureCommunityTables();
    await ensureSafetyTables();
    await ensurePushTables();
    const admin = await import("./admin.server");
    await admin.ensureAdminTables();
    await admin.ensureAdminUser();
    const sms = await import("./sms.server");
    await sms.ensureSmsTables();
    const money = await import("./monetization.server");
    await money.ensureMonetizationTables();
    const rem = await import("./reminders");
    await rem.ensureReminderTables();
    await rem.flushDueReminders();
    const inv = await import("./invites");
    await inv.ensureInviteTables();
    await ensureProfilesTable();
    await expireDueJobs();
  } catch (err) {
    console.error("[jobs] schema patch failed", err);
  }
  if (!sampleSeedEnabled()) {
    try {
      await expireDueJobs();
    } catch (err) {
      console.error("[jobs] expire failed", err);
    }
    jobsReady = true;
    return;
  }
  try {
    const rows = await sql.query<{ n: number }>("select count(*)::int as n from jobs");
    if ((rows[0]?.n ?? 0) === 0) {
      for (const job of seedJobs) {
        await insertSeedJob(sql, job);
      }
    } else {
      for (const category of ["casnic", "altele"] as const) {
        const existing = await sql.query<{ n: number }>(
          "select count(*)::int as n from jobs where category = $1",
          [category],
        );
        if ((existing[0]?.n ?? 0) === 0) {
          for (const job of seedJobs.filter((j) => j.category === category)) {
            await insertSeedJob(sql, job);
          }
        }
      }
    }
    await seedOfficialJobs();
    await cleanupPublicListings(sql);
    await seedDemoApplications();
    await expireDueJobs();
    jobsReady = true;
  } catch (err) {
    console.error("[jobs] seed failed", err);
  }
}

async function seedOfficialJobs() {
  const sql = await getSql();
  const existing = await sql.query<{ n: number }>(
    "select count(*)::int as n from jobs where coalesce(kind, 'rapid') = 'oficial'",
  );
  if ((existing[0]?.n ?? 0) > 0) return;
  const rows: Array<{
    title: string;
    description: string;
    category: string;
    raion: string;
    locality: string;
    payment_mdl: number;
    people_needed: number;
    poster_name: string;
    company: string;
    contract_type: string;
    schedule: string;
  }> = [
    {
      title: "Vânzător magazin alimentar",
      description:
        "Căutăm vânzător pentru magazin în Botanica. Program de zi, contract de muncă, salariu lunar plus bonusuri pe vânzări. Experiență în retail e un plus, nu e obligatorie.",
      category: "vanzari",
      raion: "Chișinău",
      locality: "Botanica",
      payment_mdl: 7500,
      people_needed: 2,
      poster_name: "Market Plus",
      company: "Market Plus SRL",
      contract_type: "nedeterminat",
      schedule: "full",
    },
    {
      title: "Ospătar restaurant — tură de seară",
      description:
        "Restaurant în Centru angajează ospătar. Contract oficial, masă la serviciu, program în ture. Căutăm o persoană zâmbitoare, cu română fluentă.",
      category: "horeca",
      raion: "Chișinău",
      locality: "Centru",
      payment_mdl: 8000,
      people_needed: 3,
      poster_name: "Casa Veche",
      company: "Casa Veche",
      contract_type: "determinat",
      schedule: "shifts",
    },
    {
      title: "Operator depozit — Chișinău",
      description:
        "Depozit logistic angajează operator. Ridicare-descărcare, scanare colete, ordine în rafturi. Contract, echipament de protecție, transport de la poarta depozitului.",
      category: "logistica",
      raion: "Chișinău",
      locality: "Ciocana",
      payment_mdl: 9000,
      people_needed: 4,
      poster_name: "LogiMD",
      company: "LogiMD",
      contract_type: "nedeterminat",
      schedule: "full",
    },
    {
      title: "Asistent medical clinică",
      description:
        "Clinică privată caută asistent medical. Program de zi, contract pe durată nedeterminată. Diplomă și experiență minim 1 an.",
      category: "medical",
      raion: "Chișinău",
      locality: "Buiucani",
      payment_mdl: 11000,
      people_needed: 1,
      poster_name: "Clinica Nord",
      company: "Clinica Nord",
      contract_type: "nedeterminat",
      schedule: "full",
    },
    {
      title: "Contabil junior — Bălți",
      description:
        "Firmă de producție angajează contabil junior. Program de birou 9–18, contract, posibilitate de stagiu plătit dacă ești la început.",
      category: "birou",
      raion: "Bălți",
      locality: "Bălți",
      payment_mdl: 8500,
      people_needed: 1,
      poster_name: "Nord Agro",
      company: "Nord Agro SRL",
      contract_type: "intern",
      schedule: "full",
    },
  ];
  for (const job of rows) {
    await sql.query(
      `insert into jobs (
        user_id, title, description, category, raion, locality,
        payment_mdl, duration_minutes, people_needed, contact_phone, poster_name, status,
        kind, company, contract_type, schedule, salary_period, starts_at
      ) values ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,'open','oficial',$11,$12,$13,'month', null)`,
      [
        SEED_USER,
        job.title,
        job.description,
        job.category,
        job.raion,
        job.locality,
        job.payment_mdl,
        job.people_needed,
        "069123100",
        job.poster_name,
        job.company,
        job.contract_type,
        job.schedule,
      ],
    );
  }
}

async function seedDemoApplications() {
  const sql = await getSql();
  const existing = await sql.query<{ n: number }>("select count(*)::int as n from applications");
  if ((existing[0]?.n ?? 0) > 0) return;
  const jobs = await sql.query<{ id: number; title: string }>(
    "select id, title from jobs where user_id = $1",
    [SEED_USER],
  );
  const byTitle = Object.fromEntries(jobs.map((j) => [j.title, j.id]));
  const warehouse = byTitle["Mutare depozit mic"];
  const roof = byTitle["Ajutor pe acoperiș — țiglă metalică"];
  const move = byTitle["Mutare apartament 2 camere"];
  const rows: Array<[number, string, string, string, string, string]> = [];
  if (warehouse) {
    rows.push(
      [warehouse, "seed-app-1", "Ion", "Popescu", "069111001", "selected"],
      [warehouse, "seed-app-2", "Maria", "Ciobanu", "069111002", "selected"],
      [warehouse, "seed-app-3", "Vasile", "Lungu", "069111003", "pending"],
    );
  }
  if (roof) {
    rows.push(
      [roof, "seed-app-4", "Andrei", "Munteanu", "069111004", "selected"],
      [roof, "seed-app-5", "Gheorghe", "Balan", "069111005", "contacted"],
    );
  }
  if (move) {
    rows.push([move, "seed-app-6", "Elena", "Russo", "069111006", "selected"]);
  }
  for (const [jobId, userId, first, last, phone, status] of rows) {
    await sql.query(
      `insert into applications (job_id, user_id, applicant_name, first_name, last_name, message, contact_phone, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        jobId,
        userId,
        `${first} ${last}`,
        first,
        last,
        "Pot ajunge mâine dimineață. Am făcut treaba asta înainte.",
        phone,
        status,
      ],
    );
  }
}

const JOB_SELECT = `j.id, j.user_id, j.title, j.description, j.category, j.raion, j.locality,
  j.payment_mdl, j.duration_minutes, j.people_needed,
  -- Never expose the poster's phone in listings: it is shared only through
  -- getContactPhone once an application links both users (see profile.ts).
  null::text as contact_phone, j.poster_name,
  j.status, j.created_at, j.starts_at, coalesce(j.views_count, 0) as views_count,
  (j.geo_lat is not null and j.geo_lng is not null) as has_geo,
  coalesce(j.kind, 'rapid') as kind,
  coalesce(j.company, '') as company,
  coalesce(j.contract_type, '') as contract_type,
  coalesce(j.schedule, '') as schedule,
  coalesce(j.salary_period, 'spot') as salary_period,
  coalesce(j.boost_tier, '') as boost_tier,
  j.boost_until,
  coalesce(j.details, '{}'::jsonb) as details,
  (coalesce(j.adults_only, false) or coalesce(j.kind, 'rapid') = 'oficial') as adults_only,
  (select count(*)::int from applications a where a.job_id = j.id) as application_count,
  (select count(*)::int from applications a where a.job_id = j.id and a.status = 'selected') as selected_count,
  coalesce((select avg(r.stars)::float from ratings r where r.to_user_id = j.user_id and ${VISIBLE_RATING_SQL("r")}), 0) as poster_rating_avg,
  (select count(*)::int from ratings r where r.to_user_id = j.user_id and ${VISIBLE_RATING_SQL("r")}) as poster_rating_count,
  coalesce((select p.phone_verified_at is not null from profiles p where p.user_id = j.user_id), false) as poster_phone_verified`;

const filtersSchema = z.object({
  q: z.string().optional(),
  raion: z.string().optional(),
  locality: z.string().optional(),
  category: z.string().optional(),
  when: z.enum(["today", "urgent", "soon3h"]).optional(),
  blocked: z.string().optional(),
  excludeId: z.number().int().optional(),
  preferRaion: z.string().optional(),
  limit: z.number().int().min(1).max(80).optional(),
  kind: z.enum(["rapid", "oficial"]).optional().default("rapid"),
});

export const listJobs = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((d: unknown) => filtersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await seedIfEmpty();
    void maybeSendRatingReminders();
    const sql = await getSql();
    const conditions = [
      "j.status = 'open'",
      "j.people_needed > (select count(*)::int from applications a where a.job_id = j.id and a.status = 'selected')",
      "coalesce(j.hidden, false) = false",
      ...(sampleJobsVisible() ? [] : [HIDE_SAMPLE_JOBS_SQL]),
      `not exists (
         select 1 from profiles p
         where p.user_id = j.user_id
           and p.banned_at is not null
           and (p.banned_until is null or p.banned_until > now())
       )`,
    ];
    const kind = data.kind === "oficial" ? "oficial" : "rapid";
    conditions.push(`coalesce(j.kind, 'rapid') = '${kind}'`);
    if (kind === "rapid") {
      conditions.push("j.starts_at > now()");
    }
    const params: unknown[] = [];
    let i = 1;
    if (data.q?.trim()) {
      const tokens = data.q.trim().split(/\s+/).filter(Boolean).slice(0, 6);
      const clauses: string[] = [];
      for (const tok of tokens) {
        clauses.push(
          `(j.title ilike $${i} or j.description ilike $${i} or j.locality ilike $${i} or j.raion ilike $${i} or j.poster_name ilike $${i} or j.category ilike $${i} or j.company ilike $${i})`,
        );
        params.push(`%${tok}%`);
        i += 1;
      }
      if (clauses.length === 1) conditions.push(clauses[0]);
      else if (clauses.length > 1) conditions.push(`(${clauses.join(" or ")})`);
    }
    if (data.raion) {
      conditions.push(`j.raion = $${i++}`);
      params.push(data.raion);
    }
    if (data.locality) {
      conditions.push(`j.locality = $${i++}`);
      params.push(data.locality);
    }
    if (data.category && (isCategoryId(data.category) || isOfficialCategory(data.category))) {
      conditions.push(`j.category = $${i++}`);
      params.push(data.category);
    }
    if (kind === "rapid" && data.when === "today") {
      conditions.push(`(j.starts_at at time zone 'Europe/Chisinau')::date = (now() at time zone 'Europe/Chisinau')::date`);
    } else if (data.when === "urgent") {
      conditions.push(`j.starts_at <= now() + interval '24 hours'`);
    } else if (data.when === "soon3h") {
      conditions.push(`j.starts_at <= now() + interval '3 hours'`);
    }
    if (data.excludeId) {
      conditions.push(`j.id <> $${i++}`);
      params.push(data.excludeId);
    }
    const blockedIds = new Set<string>();
    if (data.blocked) {
      for (const id of data.blocked.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 80)) {
        blockedIds.add(id);
      }
    }
    if (context.userId) {
      try {
        const set = await blockedSetFor(context.userId);
        for (const id of set) blockedIds.add(id);
      } catch {
        /* ignore */
      }
    }
    for (const id of blockedIds) {
      conditions.push(`j.user_id <> $${i++}`);
      params.push(id);
    }
    const boostOrder = `(case when j.boost_until > now() then case j.boost_tier when 'urgent' then 3 when 'rapid' then 2 when 'standard' then 1 else 0 end else 0 end) desc`;
    let order = `order by ${boostOrder}, j.created_at desc`;
    if (data.preferRaion) {
      order = `order by ${boostOrder}, (j.raion = $${i}) desc, j.created_at desc`;
      params.push(data.preferRaion);
    }
    const limit = data.limit ? ` limit ${Number(data.limit)}` : " limit 60";
    return sql.query<Job>(
      `select ${JOB_SELECT} from jobs j where ${conditions.join(" and ")} ${order}${limit}`,
      params,
    );
  });

export const getJob = createServerFn({ method: "POST" })
  .validator((id: unknown) => z.number().int().positive().max(2_147_483_647).parse(id))
  .handler(async ({ data: id }) => {
    await seedIfEmpty();
    const sql = await getSql();
    const rows = await sql.query<Job>(
      `select ${JOB_SELECT} from jobs j
       where j.id = $1 and coalesce(j.hidden, false) = false
       ${sampleJobsVisible() ? "" : `and ${HIDE_SAMPLE_JOBS_SQL}`}`,
      [id],
    );
    return rows[0] ?? null;
  });

export type ExactJobLocation =
  | { visible: true; lat: number; lng: number }
  | { visible: false };

export const getJobExactLocation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ jobId: z.number().int() }).parse(d))
  .handler(async ({ context, data }): Promise<ExactJobLocation> => {
    await seedIfEmpty();
    const sql = await getSql();
    const rows = await sql.query<{
      user_id: string;
      geo_lat: number | string | null;
      geo_lng: number | string | null;
    }>(
      `select user_id, geo_lat, geo_lng from jobs
       where id = $1 and coalesce(hidden, false) = false`,
      [data.jobId],
    );
    const job = rows[0];
    if (!job || job.geo_lat == null || job.geo_lng == null) return { visible: false };
    const lat = Number(job.geo_lat);
    const lng = Number(job.geo_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { visible: false };
    if (job.user_id === context.userId) return { visible: true, lat, lng };
    const app = await sql.query<{ status: string }>(
      `select status from applications where job_id = $1 and user_id = $2`,
      [data.jobId, context.userId],
    );
    if (app[0]?.status === "selected") return { visible: true, lat, lng };
    return { visible: false };
  });

const createJobSchema = z.object({
  kind: z.enum(["rapid", "oficial"]).optional().default("rapid"),
  title: z.string().trim().min(3, "post.errTitleShort").max(120),
  description: z.string().trim().min(20, "post.errDescShort").max(2000),
  category: z.string(),
  raion: z.string(),
  locality: z.string().trim().min(2).max(80),
  payment_mdl: z.number().int().min(0).max(200000),
  duration_minutes: z.number().int().min(0).max(24 * 60).optional().default(0),
  people_needed: z.number().int().min(1).max(30),
  contact_phone: z.string().trim().max(20).optional().default(""),
  poster_name: z.string().trim().min(2).max(80),
  starts_at: z.string().optional().default(""),
  captcha: captchaSchema,
  geo_lat: z.number().finite().nullable().optional(),
  geo_lng: z.number().finite().nullable().optional(),
  company: z.string().trim().max(80).optional().default(""),
  contract_type: z.string().trim().max(40).optional().default(""),
  schedule: z.string().trim().max(40).optional().default(""),
  salary_period: z.enum(["spot", "month", "hour"]).optional().default("spot"),
  details: jobDetailsSchema.optional(),
  adults_only: z.boolean().optional(),
});

export const createJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => createJobSchema.parse(d))
  .handler(async ({ context, data }) => {
    await seedIfEmpty();
    const { assertNotBanned } = await import("./admin.server");
    await assertNotBanned(context.userId);
    await assertProfileActive(context.userId);
    const { assertRateLimit } = await import("./rate-limit.server");
    await assertRateLimit("post_job", 10, 60);
    const { assertCanPost } = await import("./monetization.server");
    await assertCanPost(context.userId);
    await ensureSafetyTables();
    await assertCaptcha(data.captcha.token, data.captcha.answer);
    const kind = isJobKind(data.kind) ? data.kind : "rapid";
    if (kind === "oficial") {
      if (!isOfficialCategory(data.category)) throw new Error("Categorie invalidă");
      if (!data.company.trim()) throw new Error("Adaugă numele firmei");
      if (!isContractType(data.contract_type)) throw new Error("Tip de contract invalid");
      if (!isSchedule(data.schedule)) throw new Error("Program invalid");
    } else if (!isCategoryId(data.category)) {
      throw new Error("Categorie invalidă");
    }
    if (!isKnownRaion(data.raion)) throw new Error("Raion invalid");
    if (kind === "rapid" && data.payment_mdl < 50) throw new Error("Plata minimă este 50 MDL");
    let startsIso: string | null = null;
    if (kind === "rapid") {
      if (!data.starts_at) throw new Error("Data sau ora este invalidă");
      const starts = new Date(data.starts_at);
      if (Number.isNaN(starts.getTime())) throw new Error("Data sau ora este invalidă");
      if (starts.getTime() <= Date.now()) {
        throw new Error("Data și ora trebuie să fie în viitor");
      }
      if (data.duration_minutes < 15) throw new Error("Durata este prea scurtă");
      startsIso = starts.toISOString();
    }
    const sql = await getSql();
    const recent = await sql.query<{ n: number }>(
      `select count(*)::int as n from jobs
       where user_id = $1 and created_at > now() - interval '2 hours'`,
      [context.userId],
    );
    if ((recent[0]?.n ?? 0) >= 3) {
      throw new Error("Ai atins limita de 3 anunțuri în 2 ore. Reîncearcă mai târziu.");
    }
    const contactPhone = await accountContactPhone(context.userId);
    const geo = normalizeJobGeo(data.geo_lat, data.geo_lng);
    const rows = await sql.query<{ id: number }>(
      `insert into jobs (
        user_id, title, description, category, raion, locality,
        payment_mdl, duration_minutes, people_needed, contact_phone, poster_name, starts_at,
        geo_lat, geo_lng, kind, company, contract_type, schedule, salary_period, details, adults_only
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21) returning id`,
      [
        context.userId,
        data.title,
        data.description,
        data.category,
        data.raion,
        data.locality,
        data.payment_mdl,
        kind === "rapid" ? data.duration_minutes : 0,
        data.people_needed,
        contactPhone,
        data.poster_name,
        startsIso,
        geo?.lat ?? null,
        geo?.lng ?? null,
        kind,
        kind === "oficial" ? data.company.trim() : "",
        kind === "oficial" ? data.contract_type : "",
        kind === "oficial" ? data.schedule : "",
        kind === "oficial" ? "month" : "spot",
        JSON.stringify(kind === "oficial" ? normalizeJobDetails(data.details) : {}),
        kind === "oficial"
          ? true
          : (data.adults_only ?? (HEAVY_CATEGORIES as readonly string[]).includes(data.category)),
      ],
    );
    const jobId = rows[0].id;
    void notifyNewJobInRaion({
      raion: data.raion,
      title: data.title,
      jobId,
      exceptUserId: context.userId,
      category: data.category,
    });
    return { id: jobId };
  });

const applySchema = z.object({
  jobId: z.number().int(),
  message: z.string().trim().max(800).optional().default(""),
  contact_phone: z.string().trim().max(20).optional().default(""),
  first_name: z.string().trim().max(40).optional().default(""),
  last_name: z.string().trim().max(40).optional().default(""),
  cv_kind: z.enum(["", "site", "file"]).optional().default(""),
  cv_file_id: z.number().int().nullable().optional(),
  email: z.string().trim().max(120).optional().default(""),
  consent: z.boolean().optional().default(false),
});

const DEFAULT_APPLY_MESSAGE =
  "Sunt disponibil. Vă rog să mă contactați dacă sunt selectat.";

export const applyToJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => applySchema.parse(d))
  .handler(async ({ context, data }) => {
    await seedIfEmpty();
    const { assertNotBanned } = await import("./admin.server");
    await assertNotBanned(context.userId);
    await assertProfileActive(context.userId);
    const { assertCanApply } = await import("./monetization.server");
    await assertCanApply(context.userId);
    const sql = await getSql();
    const jobs = await sql.query<Job>(
      `select ${JOB_SELECT} from jobs j where j.id = $1`,
      [data.jobId],
    );
    const job = jobs[0];
    if (!job) throw new Error("Jobul nu mai există");
    const hidden = await sql.query<{ hidden: boolean }>(
      "select coalesce(hidden, false) as hidden from jobs where id = $1",
      [data.jobId],
    );
    if (hidden[0]?.hidden) throw new Error("Anunțul nu mai este disponibil");
    if (job.status === "cancelled") throw new Error("Anunțul a fost anulat");
    if (job.status === "expired") throw new Error("Anunțul a expirat");
    if (job.status === "completed" || job.status === "closed") {
      throw new Error("Jobul este finalizat");
    }
    if (job.status !== "open") throw new Error("Jobul nu mai este deschis");
    if (jobKind(job.kind) === "rapid" && job.starts_at && new Date(job.starts_at).getTime() <= Date.now()) {
      throw new Error("Anunțul a expirat");
    }
    if (job.user_id === context.userId) throw new Error("Nu poți aplica la propriul anunț");
    await assertNotBlocked(context.userId, job.user_id);
    if (job.people_needed <= job.selected_count) throw new Error("Locurile sunt ocupate");
    // Age rules: 16+ everywhere, 18+ for "angajare" and heavy physical work.
    const by = await sql.query<{ birth_year: number | null }>("select birth_year from profiles where user_id = $1", [
      context.userId,
    ]);
    const age = ageFromYear(by[0]?.birth_year);
    if (age === null) throw new Error("srv.needBirthYear");
    if (age < MIN_AGE) throw new Error("srv.tooYoung");
    if (job.adults_only && age < ADULT_AGE) throw new Error("srv.adultsOnly");
    const contactPhone = await accountContactPhone(context.userId);
    const profile = await sql.query<{ first_name: string; last_name: string }>(
      `select coalesce(first_name,'') as first_name, coalesce(last_name,'') as last_name
       from profiles where user_id = $1`,
      [context.userId],
    );
    const firstName = (data.first_name || profile[0]?.first_name || "").trim();
    const lastName = (data.last_name || profile[0]?.last_name || "").trim();
    if (firstName.length < 2 || lastName.length < 2) {
      throw new Error("Completează prenumele și numele în profil pentru a aplica.");
    }
    const note = data.message.trim().length >= 8 ? data.message.trim() : DEFAULT_APPLY_MESSAGE;
    // "Angajare" jobs need a CV: the one built on the site, or an uploaded file.
    let cvKind = "";
    let cvSnapshot: string | null = null;
    let cvPhoto: string | null = null;
    let cvFileId: number | null = null;
    const email = data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? data.email : "";
    if (jobKind(job.kind) === "oficial") {
      if (!data.consent) throw new Error("cv.errConsent");
      if (data.cv_kind === "site") {
        const cvRows = await sql.query<{ data: unknown; photo: string | null }>(
          "select data, photo from cvs where user_id = $1",
          [context.userId],
        );
        const cv = cvRows[0] ? normalizeCv(cvRows[0].data) : null;
        if (!cv || !cvIsUsable(cv)) throw new Error("cv.errNoCv");
        cvKind = "site";
        cvSnapshot = JSON.stringify(cv);
        cvPhoto = cvRows[0]?.photo ?? null;
      } else if (data.cv_kind === "file" && data.cv_file_id) {
        const f = await sql.query<{ id: number }>("select id from cv_files where id = $1 and user_id = $2", [
          data.cv_file_id,
          context.userId,
        ]);
        if (!f[0]) throw new Error("cv.errNotFound");
        cvKind = "file";
        cvFileId = f[0].id;
      } else {
        throw new Error("cv.errNoCv");
      }
    }
    const existing = await sql.query<{ id: number; status: string }>(
      "select id, status from applications where job_id = $1 and user_id = $2",
      [data.jobId, context.userId],
    );
    const fullName = `${firstName} ${lastName}`;
    if (existing[0]) {
      if (existing[0].status !== "withdrawn") throw new Error("Ai aplicat deja la acest job");
      await sql.query(
        `update applications
         set applicant_name = $1, first_name = $2, last_name = $3, message = $4,
             contact_phone = $5, status = 'pending', created_at = now(),
             cv_kind = $7, cv_snapshot = $8::jsonb, cv_photo = $9, cv_file_id = $10, email = $11,
             viewed_at = null, interview_at = null, interview_note = ''
         where id = $6`,
        [fullName, firstName, lastName, note, contactPhone, existing[0].id, cvKind, cvSnapshot, cvPhoto, cvFileId, email],
      );
      void notifyUser(job.user_id, {
        title: "Aplicație nouă",
        body: `${fullName} a aplicat la „${job.title}”.`,
        url: "/aplicatii",
        telegram: true,
      }, context.userId);
      return { ok: true as const };
    }
    await sql.query(
      `insert into applications (job_id, user_id, applicant_name, first_name, last_name, message, contact_phone,
                                 cv_kind, cv_snapshot, cv_photo, cv_file_id, email)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
      [
        data.jobId,
        context.userId,
        fullName,
        firstName,
        lastName,
        note,
        contactPhone,
        cvKind,
        cvSnapshot,
        cvPhoto,
        cvFileId,
        email,
      ],
    );
    void notifyUser(job.user_id, {
      title: "Aplicație nouă",
      body: `${fullName} a aplicat la „${job.title}”.`,
      url: "/aplicatii",
      telegram: true,
    }, context.userId);
    return { ok: true as const };
  });

export const listMyJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await seedIfEmpty();
    const sql = await getSql();
    return sql.query<Job>(
      `select ${JOB_SELECT} from jobs j where j.user_id = $1 order by j.created_at desc`,
      [context.userId],
    );
  });

export const listFavoriteJobs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await seedIfEmpty();
    const sql = await getSql();
    return sql.query<Job>(
      `select ${JOB_SELECT}
       from favorites f
       join jobs j on j.id = f.job_id
       where f.user_id = $1 and coalesce(j.hidden, false) = false
       order by f.created_at desc`,
      [context.userId],
    );
  });

export type MyApplication = Application & {
  job_title: string;
  job_locality: string;
  job_raion: string;
  job_payment_mdl: number;
  job_status: string;
  job_starts_at: string | null;
  job_user_id: string;
  poster_name: string;
  job_people_needed: number;
  job_selected_count: number;
  job_has_geo: boolean;
  job_kind?: string;
  job_company?: string;
};

export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await seedIfEmpty();
    const sql = await getSql();
    return sql.query<MyApplication>(
      `select a.id, a.job_id, a.user_id, a.applicant_name, a.first_name, a.last_name,
              a.message, a.contact_phone, a.status, a.created_at, a.viewed_at, a.interview_at, a.interview_note, a.cv_kind,
              coalesce(j.kind, 'rapid') as job_kind, coalesce(j.company, '') as job_company,
              j.title as job_title, j.locality as job_locality, j.raion as job_raion,
              j.payment_mdl as job_payment_mdl, j.status as job_status, j.starts_at as job_starts_at,
              j.user_id as job_user_id, j.poster_name as poster_name,
              j.people_needed as job_people_needed,
              (select count(*)::int from applications s where s.job_id = j.id and s.status = 'selected') as job_selected_count,
              (j.geo_lat is not null and j.geo_lng is not null) as job_has_geo
       from applications a
       join jobs j on j.id = a.job_id
       where a.user_id = $1
       order by a.created_at desc`,
      [context.userId],
    );
  });

export const listJobApplications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    const sql = await getSql();
    const jobs = await sql.query<{ user_id: string }>(
      "select user_id from jobs where id = $1",
      [jobId],
    );
    if (!jobs[0] || jobs[0].user_id !== context.userId) {
      throw new Error("Nu poți vedea aceste aplicații");
    }
    return sql.query<Application>(
      "select * from applications where job_id = $1 order by created_at desc",
      [jobId],
    );
  });

export const closeJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      "update jobs set status = 'closed' where id = $1 and user_id = $2 returning id",
      [jobId, context.userId],
    );
    if (!rows[0]) throw new Error("Nu poți închide acest anunț");
    return { ok: true as const };
  });

export const hasApplied = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      "select id from applications where job_id = $1 and user_id = $2 and status <> 'withdrawn'",
      [jobId, context.userId],
    );
    return Boolean(rows[0]);
  });

export type InboxJob = Job & {
  applicants: Application[];
};

export const listPosterInbox = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await seedIfEmpty();
    const sql = await getSql();
    const jobs = await sql.query<Job>(
      `select ${JOB_SELECT} from jobs j where j.user_id = $1 order by j.created_at desc`,
      [context.userId],
    );
    if (jobs.length === 0) return [] as InboxJob[];
    const ids = jobs.map((j) => j.id);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    await ensureRatingsTable();
    const apps = await sql.query<Application>(
      `select a.id, a.job_id, a.user_id, a.applicant_name, a.first_name, a.last_name, a.message,
              a.contact_phone, a.status, a.created_at, a.cv_kind, a.cv_snapshot, a.cv_file_id, a.email,
              a.viewed_at, a.interview_at, a.interview_note, a.employer_note,
              coalesce((select avg(r.stars)::float from ratings r where r.to_user_id = a.user_id and ${VISIBLE_RATING_SQL("r")}), 0) as applicant_rating_avg,
              (select count(*)::int from ratings r where r.to_user_id = a.user_id and ${VISIBLE_RATING_SQL("r")}) as applicant_rating_count
       from applications a where a.job_id in (${placeholders}) order by a.created_at desc`,
      ids,
    );
    return jobs.map((job) => ({
      ...job,
      applicants: apps.filter((a) => a.job_id === job.id),
    }));
  });

const appStatusSchema = z.object({
  applicationId: z.number().int(),
  status: z.enum(["contacted", "selected", "declined", "pending", "withdrawn"]),
});

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => appStatusSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const owned = await sql.query<{ id: number }>(
      `select a.id from applications a
       join jobs j on j.id = a.job_id
       where a.id = $1 and j.user_id = $2`,
      [data.applicationId, context.userId],
    );
    if (!owned[0]) throw new Error("Nu poți actualiza această aplicație");
    const info = await sql.query<{
      user_id: string;
      title: string;
      job_id: number;
      has_geo: boolean;
      status: string;
      people_needed: number;
      selected_count: number;
      starts_at: string | null;
      kind: string;
      company: string;
    }>(
      `select a.user_id, a.status, j.title, j.id as job_id, j.people_needed, j.starts_at,
              coalesce(j.kind, 'rapid') as kind, coalesce(j.company, '') as company,
              (j.geo_lat is not null and j.geo_lng is not null) as has_geo,
              (select count(*)::int from applications s where s.job_id = j.id and s.status = 'selected') as selected_count
       from applications a join jobs j on j.id = a.job_id
       where a.id = $1`,
      [data.applicationId],
    );
    const row = info[0];
    if (!row) throw new Error("Nu poți actualiza această aplicație");
    if (row.status === data.status) return { ok: true as const };
    // "Contacted" is set automatically by the Call button: never downgrade a decision.
    if (data.status === "contacted" && row.status !== "pending") return { ok: true as const };
    if (data.status === "selected" && row.selected_count >= Math.max(1, row.people_needed || 1)) {
      throw new Error("Toate locurile sunt deja ocupate");
    }
    await sql.query(`update applications set status = $1 where id = $2`, [
      data.status,
      data.applicationId,
    ]);
    const official = row.kind === "oficial";
    if (official && (data.status === "selected" || data.status === "declined")) {
      const who = row.company ? `${row.company}` : "Angajatorul";
      void notifyUser(row.user_id, {
        title: data.status === "selected" ? "Felicitări! Ai fost angajat 🎉" : "Răspuns la CV-ul tău",
        body:
          data.status === "selected"
            ? `${who} te-a ales pentru postul „${row.title}”. Vezi detaliile și contactul pe anunț.`
            : `${who} îți mulțumește pentru interes față de postul „${row.title}”. De data aceasta a ales alt candidat. Îți dorim succes!`,
        url: `/jobs/${row.job_id}`,
        telegram: true,
      }, context.userId);
    } else if (data.status === "selected" || data.status === "declined") {
      const when = row.starts_at ? ` (${formatStartsAtRo(row.starts_at)})` : "";
      const selectedBody = row.has_geo
        ? `Ai fost selectat la „${row.title}”${when}. Adresa exactă și harta sunt acum pe anunț.`
        : `Ai fost selectat la „${row.title}”${when}. Vezi toate detaliile pe anunț.`;
      void notifyUser(row.user_id, {
        title: data.status === "selected" ? "Ai fost selectat ✅" : "Nu ai fost ales",
        body:
          data.status === "selected"
            ? selectedBody
            : `De data asta nu ai fost ales la „${row.title}”. Mai sunt multe lucruri pe Rabotaem.md.`,
        url: `/jobs/${row.job_id}`,
        telegram: true,
      }, context.userId);
    }
    return { ok: true as const };
  });

function formatStartsAtRo(iso: string) {
  try {
    return new Intl.DateTimeFormat("ro-MD", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Chisinau",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

/** The signed-in user's application to one job, with what they need once selected. */
export const getMyApplicationForJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => z.number().int().parse(jobId))
  .handler(async ({ context, data: jobId }) => {
    const sql = await getSql();
    await ensureProfilesTable();
    const rows = await sql.query<{
      id: number;
      status: string;
      poster_id: string;
      poster_phone: string | null;
      viewed_at: string | null;
      interview_at: string | null;
      interview_note: string;
      cv_kind: string;
    }>(
      `select a.id, a.status, j.user_id as poster_id, a.viewed_at, a.interview_at, a.interview_note, a.cv_kind,
              case when a.status in ('selected', 'interview') then coalesce(nullif(p.phone, ''), nullif(j.contact_phone, '')) else null end as poster_phone
       from applications a
       join jobs j on j.id = a.job_id
       left join profiles p on p.user_id = j.user_id
       where a.job_id = $1 and a.user_id = $2
       limit 1`,
      [jobId, context.userId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      status: r.status as AppStatus,
      posterPhone: r.poster_phone,
      viewedAt: r.viewed_at,
      interviewAt: r.interview_at,
      interviewNote: r.interview_note,
      cvKind: r.cv_kind,
    };
  });

/** Small counters for the menu badge and the "you were selected" banner. */
export const getAppsSummary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const fresh = await sql.query<{ n: number }>(
      `select count(*)::int as n
       from applications a join jobs j on j.id = a.job_id
       where j.user_id = $1 and a.status = 'pending' and j.status = 'open'`,
      [context.userId],
    );
    const selected = await sql.query<{ id: number; job_id: number; title: string; starts_at: string | null; status: string }>(
      `select a.id, a.job_id, j.title, j.starts_at, a.status
       from applications a join jobs j on j.id = a.job_id
       where a.user_id = $1 and a.status in ('selected', 'interview')
         and j.status not in ('cancelled', 'completed')
         and (j.starts_at is null or j.starts_at > now() - interval '12 hours')
       order by j.starts_at nulls last
       limit 10`,
      [context.userId],
    );
    return { newApplicants: fresh[0]?.n ?? 0, selected };
  });

export const completeJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    await seedIfEmpty();
    const sql = await getSql();
    const rows = await sql.query<{ id: number; title: string }>(
      `update jobs set status = 'completed', completed_at = now()
       where id = $1 and user_id = $2 and status in ('open', 'expired', 'closed')
       returning id, title`,
      [jobId, context.userId],
    );
    if (!rows[0]) throw new Error("Nu poți marca acest anunț ca finalizat");
    const workers = await sql.query<{ user_id: string }>(
      "select user_id from applications where job_id = $1 and status = 'selected'",
      [jobId],
    );
    void notifyUsers(
      workers.map((w) => w.user_id),
      {
        title: "Job finalizat",
        body: `„${rows[0].title}” a fost marcat ca finalizat. Poți lăsa o evaluare.`,
        url: "/cont?tab=ratings",
      },
      context.userId,
    );
    return { ok: true as const };
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number; title: string }>(
      "update jobs set status = 'cancelled' where id = $1 and user_id = $2 and status <> 'cancelled' returning id, title",
      [jobId, context.userId],
    );
    if (!rows[0]) throw new Error("Nu poți anula acest anunț");
    const apps = await sql.query<{ user_id: string }>(
      "select user_id from applications where job_id = $1 and status not in ('withdrawn', 'declined')",
      [jobId],
    );
    void notifyUsers(
      apps.map((a) => a.user_id),
      {
        title: "Anunț anulat",
        body: `„${rows[0].title}” a fost anulat.`,
        url: "/",
      },
      context.userId,
    );
    return { ok: true as const };
  });

const reactivateSchema = z.object({
  jobId: z.number().int(),
  starts_at: z.string().min(10).optional(),
});

export const reactivateJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => reactivateSchema.parse(d))
  .handler(async ({ context, data }) => {
    await seedIfEmpty();
    const sql = await getSql();
    const jobs = await sql.query<Job>(
      `select ${JOB_SELECT} from jobs j where j.id = $1 and j.user_id = $2`,
      [data.jobId, context.userId],
    );
    const job = jobs[0];
    if (!job) throw new Error("Nu poți reactiva acest anunț");
    const expired = job.status === "expired";
    if (job.status !== "completed" && !expired) {
      throw new Error("Poți reactiva doar un anunț finalizat sau expirat");
    }
    if (job.status === "completed" && job.people_needed <= job.selected_count) {
      throw new Error("Nu sunt locuri libere. Un muncitor confirmat trebuie să anuleze mai întâi.");
    }
    let startsAt = job.starts_at;
    if (data.starts_at) {
      const parsed = new Date(data.starts_at);
      if (Number.isNaN(parsed.getTime())) throw new Error("Data sau ora este invalidă");
      startsAt = parsed.toISOString();
    }
    if (!startsAt) throw new Error("Data și ora sunt obligatorii");
    if (new Date(startsAt).getTime() <= Date.now()) {
      throw new Error("Alege o dată și o oră în viitor");
    }
    await sql.query(
      "update jobs set status = 'open', starts_at = $1, expire_notified = false where id = $2 and user_id = $3",
      [startsAt, data.jobId, context.userId],
    );
    const apps = await sql.query<{ user_id: string }>(
      "select user_id from applications where job_id = $1 and status not in ('withdrawn', 'declined')",
      [data.jobId],
    );
    void notifyUsers(
      apps.map((a) => a.user_id),
      {
        title: "Anunț reactivat",
        body: `„${job.title}” este din nou deschis.`,
        url: `/jobs/${job.id}`,
      },
      context.userId,
    );
    return { ok: true as const };
  });

export const cancelApplication = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((applicationId: number) => applicationId)
  .handler(async ({ context, data: applicationId }) => {
    const sql = await getSql();
    const before = await sql.query<{ status: string; poster_id: string; title: string; name: string }>(
      `select a.status, j.user_id as poster_id, j.title, a.applicant_name as name
       from applications a join jobs j on j.id = a.job_id
       where a.id = $1 and a.user_id = $2`,
      [applicationId, context.userId],
    );
    const rows = await sql.query<{ id: number }>(
      `update applications set status = 'withdrawn'
       where id = $1 and user_id = $2 and status <> 'withdrawn'
       returning id`,
      [applicationId, context.userId],
    );
    if (!rows[0]) throw new Error("Nu poți anula această aplicație");
    const b = before[0];
    if (b && (b.status === "selected" || b.status === "interview")) {
      void notifyUser(b.poster_id, {
        title: "Un om nu mai poate veni",
        body: `${b.name} a anunțat că nu mai poate veni la „${b.title}”. Locul s-a eliberat.`,
        url: "/aplicatii",
        telegram: true,
      }, context.userId);
    }
    return { ok: true as const };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((jobId: number) => jobId)
  .handler(async ({ context, data: jobId }) => {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      "delete from jobs where id = $1 and user_id = $2 returning id",
      [jobId, context.userId],
    );
    if (!rows[0]) throw new Error("Nu poți șterge acest anunț");
    return { ok: true as const };
  });

export const recordJobView = createServerFn({ method: "POST" })
  .validator((jobId: number) => jobId)
  .handler(async ({ data: jobId }) => {
    await ensureSafetyTables();
    const sql = await getSql();
    await sql.query("update jobs set views_count = coalesce(views_count, 0) + 1 where id = $1", [jobId]);
    return { ok: true as const };
  });

export { CATEGORIES };
