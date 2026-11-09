import "@tanstack/react-start/server-only";
import { getSql } from "@/lib/db";
import { isCategoryId } from "@/lib/categories";
import { isKnownRaion } from "@/lib/moldova";
import { once } from "@/lib/once";

export const DEMO_USER_ID = "demo-rabotaem";

type DemoTemplate = {
  title: string;
  description: string;
  category: string;
  raion: string;
  locality: string;
  payment_mdl: number;
  duration_minutes: number;
  people_needed: number;
  contact_phone: string;
  poster_name: string;
  days: number;
  hour: number;
  minute: number;
};

const TEMPLATES: DemoTemplate[] = [
  {
    title: "Mutare canapea și dulap la etajul 3",
    description:
      "Căutăm 2 persoane pentru coborât o canapea și un dulap demontat. Scara e largă, fără lift. Lucrăm cu grijă la colțuri și uși. Plată imediat după ce mobila e în camion.",
    category: "mutari",
    raion: "Chișinău",
    locality: "Botanica",
    payment_mdl: 450,
    duration_minutes: 120,
    people_needed: 2,
    contact_phone: "069880101",
    poster_name: "Andrei M.",
    days: 0,
    hour: 18,
    minute: 0,
  },
  {
    title: "Curățenie după renovare, 3 camere",
    description:
      "Apartament după zugrăvit: praf, pete pe parchet, geamuri. Materiale sunt pe loc. Căutăm oameni atenți, nu neapărat firmă. Începem dimineața.",
    category: "curatenie",
    raion: "Orhei",
    locality: "Orhei",
    payment_mdl: 700,
    duration_minutes: 300,
    people_needed: 2,
    contact_phone: "069880102",
    poster_name: "Elena V.",
    days: 1,
    hour: 8,
    minute: 30,
  },
  {
    title: "Cosit iarbă și scos iarba tăiată",
    description:
      "Curte ~350 m² la casă. Cositoare există. Trebuie cosit, strâns iarba și aliniat bordurile. Plată pe loc după verificare.",
    category: "gradinarit",
    raion: "Ialoveni",
    locality: "Ialoveni",
    payment_mdl: 300,
    duration_minutes: 180,
    people_needed: 1,
    contact_phone: "069880103",
    poster_name: "Ion P.",
    days: 2,
    hour: 9,
    minute: 0,
  },
  {
    title: "Încărcat camion cu cutii de depozit",
    description:
      "Cutii, 2 rafturi și o masă. Camionul e al nostru. Avem nevoie de brațe la încărcat — distanță scurtă în oraș. Lucrare de după-amiază.",
    category: "mutari",
    raion: "Bălți",
    locality: "Bălți",
    payment_mdl: 550,
    duration_minutes: 150,
    people_needed: 3,
    contact_phone: "069880104",
    poster_name: "Mihai R.",
    days: 0,
    hour: 20,
    minute: 0,
  },
  {
    title: "Zugrăvit o cameră 16 m²",
    description:
      "Cameră goală, tavanul e gata. Vopsea lavabilă, trafalet și scări pe loc. Căutăm pe cineva care a mai zugrăvit. Pauză de masă asigurată.",
    category: "constructii",
    raion: "Strășeni",
    locality: "Strășeni",
    payment_mdl: 900,
    duration_minutes: 360,
    people_needed: 2,
    contact_phone: "069880105",
    poster_name: "Sergiu D.",
    days: 3,
    hour: 8,
    minute: 0,
  },
  {
    title: "Ajutor casnic: cumpărături și curățenie ușoară",
    description:
      "Cumpărături de la magazinul din cartier, apoi șters praful și spălat vase. 2–3 ore. Persoană de încredere, plată la final.",
    category: "casnic",
    raion: "Chișinău",
    locality: "Centru",
    payment_mdl: 250,
    duration_minutes: 150,
    people_needed: 1,
    contact_phone: "069880106",
    poster_name: "Tatiana S.",
    days: 1,
    hour: 14,
    minute: 0,
  },
  {
    title: "Tăiat crengi și curățat livada",
    description:
      "Livadă mică, crengi uscate de scos și de stivuit. Unelte pe loc. Experiență cu fierăstrău e un plus, dar nu obligatorie.",
    category: "gradinarit",
    raion: "Anenii Noi",
    locality: "Anenii Noi",
    payment_mdl: 400,
    duration_minutes: 180,
    people_needed: 2,
    contact_phone: "069880107",
    poster_name: "Vasile C.",
    days: 7,
    hour: 8,
    minute: 0,
  },
  {
    title: "Mutare birou: birouri, scaune, arhivă",
    description:
      "Mutăm un oficiu mic pe aceeași stradă. Lift la ambele adrese. Cutii, 4 birouri, scaune. Lucrăm fără grabă, cu grijă la calculatoare.",
    category: "mutari",
    raion: "Chișinău",
    locality: "Ciocana",
    payment_mdl: 1200,
    duration_minutes: 300,
    people_needed: 4,
    contact_phone: "069880108",
    poster_name: "Office Move",
    days: 2,
    hour: 16,
    minute: 0,
  },
  {
    title: "Spălat geamuri casă parter + etaj",
    description:
      "Casă, geamuri interioare și exterioare. Soluții și racletă pe loc. Căutăm pe cineva atent la rame și pervazuri.",
    category: "curatenie",
    raion: "Hîncești",
    locality: "Hîncești",
    payment_mdl: 350,
    duration_minutes: 150,
    people_needed: 1,
    contact_phone: "069880109",
    poster_name: "Cristina N.",
    days: 4,
    hour: 11,
    minute: 0,
  },
  {
    title: "Săpat șanț pentru fundație de gard",
    description:
      "Șanț ~20 m, adâncime 60 cm, sol moale. Lopeți pe loc. Lucrare de o zi, apă și gustare asigurate. Plată la final.",
    category: "constructii",
    raion: "Ungheni",
    locality: "Ungheni",
    payment_mdl: 800,
    duration_minutes: 420,
    people_needed: 2,
    contact_phone: "069880110",
    poster_name: "Petru L.",
    days: 3,
    hour: 7,
    minute: 30,
  },
  {
    title: "Îngrijire grădină: plivit și udat",
    description:
      "Grădină de legume ~2 ari. Plivit, udat, aranjat rândurile. Ritmul e calm. Potrivit și pentru o persoană.",
    category: "gradinarit",
    raion: "Strășeni",
    locality: "Cojușna",
    payment_mdl: 320,
    duration_minutes: 240,
    people_needed: 1,
    contact_phone: "069880111",
    poster_name: "Lilian B.",
    days: 7,
    hour: 15,
    minute: 0,
  },
  {
    title: "Montat mobilă de bucătărie",
    description:
      "Corpuri de bucătărie deja pe loc. Trebuie asamblat și prins de perete. Unelte de bază există. Experiență cu mobilă e importantă.",
    category: "altele",
    raion: "Chișinău",
    locality: "Rîșcani",
    payment_mdl: 500,
    duration_minutes: 180,
    people_needed: 1,
    contact_phone: "069880112",
    poster_name: "Oleg T.",
    days: 5,
    hour: 9,
    minute: 0,
  },
  {
    title: "Descărcat materiale de construcții",
    description:
      "Camion cu ciment, cărămidă și scânduri. Avem nevoie de 2 persoane la descărcat în curte. Lucrare scurtă, plată pe loc.",
    category: "constructii",
    raion: "Căușeni",
    locality: "Căușeni",
    payment_mdl: 450,
    duration_minutes: 120,
    people_needed: 2,
    contact_phone: "069880113",
    poster_name: "Dumitru I.",
    days: 1,
    hour: 10,
    minute: 0,
  },
  {
    title: "Curățenie casă după oaspeți",
    description:
      "Casă de oaspeți: bucătărie, salon, două dormitoare. Vase, podele, saci de gunoi. Începem dimineața, ritm calm.",
    category: "curatenie",
    raion: "Chișinău",
    locality: "Cricova",
    payment_mdl: 320,
    duration_minutes: 180,
    people_needed: 1,
    contact_phone: "069880114",
    poster_name: "Ana G.",
    days: 6,
    hour: 9,
    minute: 30,
  },
  {
    title: "Ajutor la nuntă — aranjat scaune",
    description:
      "Sală în Centru. Montat 80 de scaune și 10 mese, apoi strâns după eveniment. Lucrare de seară, 4 ore.",
    category: "altele",
    raion: "Chișinău",
    locality: "Centru",
    payment_mdl: 400,
    duration_minutes: 240,
    people_needed: 3,
    contact_phone: "069880115",
    poster_name: "Evenimente Plus",
    days: 4,
    hour: 17,
    minute: 0,
  },
  {
    title: "Tăiat lemne de foc și stivuit",
    description:
      "Lemne deja aduse. Trebuie tăiat și așezat la perete. Fierăstrău și mănuși pe loc. Plată imediat.",
    category: "gradinarit",
    raion: "Edineț",
    locality: "Edineț",
    payment_mdl: 350,
    duration_minutes: 180,
    people_needed: 2,
    contact_phone: "069880116",
    poster_name: "Nicolae F.",
    days: 8,
    hour: 8,
    minute: 0,
  },
  {
    title: "Mutare frigider și mașină de spălat",
    description:
      "De la parter pe etajul 2, fără lift. Scara e îngustă. Căutăm 2 persoane atente, cu grijă la ziduri.",
    category: "mutari",
    raion: "Bălți",
    locality: "Bălți",
    payment_mdl: 380,
    duration_minutes: 90,
    people_needed: 2,
    contact_phone: "069880117",
    poster_name: "Mihai R.",
    days: 2,
    hour: 11,
    minute: 0,
  },
];

export const ensureDemoJobColumn = once(ensureDemoJobColumnImpl);

async function ensureDemoJobColumnImpl() {
  const sql = await getSql();
  await sql.query(`alter table jobs add column if not exists is_demo boolean not null default false`);
  await sql.query(`create index if not exists jobs_is_demo_idx on jobs (is_demo) where is_demo = true`);
}

function shuffle<T>(items: T[]) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = copy[i];
    copy[i] = copy[j];
    copy[j] = current;
  }
  return copy;
}

function futureStart(days: number, hour: number, minute: number) {
  const starts = new Date();
  starts.setDate(starts.getDate() + days);
  starts.setHours(hour, minute, 0, 0);
  if (starts.getTime() <= Date.now() + 30 * 60 * 1000) {
    return new Date(Date.now() + 90 * 60 * 1000);
  }
  return starts;
}

export async function generateDemoJobs(adminId: string) {
  await ensureDemoJobColumn();
  const sql = await getSql();
  await sql.query("alter table jobs add column if not exists hidden boolean not null default false");
  await sql.query("alter table jobs add column if not exists kind text not null default 'rapid'");

  const existing = await sql.query<{ title: string }>("select lower(trim(title)) as title from jobs");
  const taken = new Set(existing.map((row) => row.title));
  const unused = shuffle(TEMPLATES.filter((job) => !taken.has(job.title.toLowerCase().trim())));
  const want = Math.min(unused.length, 8 + Math.floor(Math.random() * 5));
  const picked = unused.slice(0, want);

  let created = 0;
  let lastError = "";
  for (const job of picked) {
    if (!isCategoryId(job.category) || !isKnownRaion(job.raion)) continue;
    const starts = futureStart(job.days, job.hour, job.minute);
    try {
      await sql.query(
        `insert into jobs (
          user_id, title, description, category, raion, locality,
          payment_mdl, duration_minutes, people_needed, contact_phone, poster_name,
          status, starts_at, is_demo, hidden, kind
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open',$12,true,false,'rapid')`,
        [
          DEMO_USER_ID,
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
          starts.toISOString(),
        ],
      );
      created += 1;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Nu am putut salva anunțul demo.";
    }
  }

  if (created === 0) {
    if (lastError) throw new Error(lastError);
    return { created: 0 };
  }

  const { logAdminAction } = await import("./admin.server");
  await logAdminAction(adminId, "demo.generate", "jobs", String(created), `${created} anunțuri demo`);
  return { created };
}

export async function deleteDemoJobs(adminId: string) {
  await ensureDemoJobColumn();
  const sql = await getSql();
  try {
    await sql.query(
      `delete from applications where job_id in (select id from jobs where coalesce(is_demo, false) = true)`,
    );
  } catch {
    /* cascade may already handle this */
  }
  const rows = await sql.query<{ id: number }>(
    `delete from jobs where coalesce(is_demo, false) = true returning id`,
  );
  const deleted = rows.length;
  const { logAdminAction } = await import("./admin.server");
  await logAdminAction(adminId, "demo.delete", "jobs", String(deleted), `${deleted} anunțuri demo`);
  return { deleted };
}

export async function countDemoJobs() {
  await ensureDemoJobColumn();
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(`select count(*)::int as n from jobs where is_demo = true`);
  return rows[0]?.n ?? 0;
}
