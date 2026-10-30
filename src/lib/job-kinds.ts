export const JOB_KINDS = ["rapid", "oficial"] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const OFFICIAL_CATEGORIES = [
  { id: "vanzari", name: "Vânzări & comerț", blurb: "Magazine, retail, agenți." },
  { id: "horeca", name: "HoReCa", blurb: "Bucătărie, sală, cazare." },
  { id: "birou", name: "Birou & admin", blurb: "Secretariat, contabilitate, HR." },
  { id: "productie", name: "Producție", blurb: "Fabrică, linie, operator." },
  { id: "logistica", name: "Logistică & depozit", blurb: "Depozit, șofer, curier." },
  { id: "medical", name: "Sănătate", blurb: "Clinici, farmacii, îngrijire." },
  { id: "educatie", name: "Educație", blurb: "Școală, after-school, trainer." },
  { id: "it", name: "IT & digital", blurb: "Support, programare, design." },
  { id: "constructii_oficial", name: "Construcții", blurb: "Șantier, meserii, inginerie." },
  { id: "altele_oficial", name: "Altele", blurb: "Orice angajare oficială." },
] as const;

export type OfficialCategoryId = (typeof OFFICIAL_CATEGORIES)[number]["id"];

export const CONTRACT_TYPES = ["nedeterminat", "determinat", "intern", "prestari"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const SCHEDULES = ["full", "part", "shifts", "flexible"] as const;
export type ScheduleId = (typeof SCHEDULES)[number];

export function isJobKind(v: string | null | undefined): v is JobKind {
  return v === "rapid" || v === "oficial";
}

export function jobKind(v: string | null | undefined): JobKind {
  return v === "oficial" ? "oficial" : "rapid";
}

export function isOficial(job: { kind?: string | null }) {
  return jobKind(job.kind) === "oficial";
}

export function isOfficialCategory(value: string): value is OfficialCategoryId {
  return OFFICIAL_CATEGORIES.some((c) => c.id === value);
}

export function isContractType(value: string): value is ContractType {
  return (CONTRACT_TYPES as readonly string[]).includes(value);
}

export function isSchedule(value: string): value is ScheduleId {
  return (SCHEDULES as readonly string[]).includes(value);
}
