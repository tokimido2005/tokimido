export const CATEGORIES = [
  {
    id: "mutari",
    name: "Mutări & Transport",
    short: "Mutări",
    blurb: "Ridicare, transport, descărcare.",
  },
  {
    id: "curatenie",
    name: "Curățenie",
    short: "Curățenie",
    blurb: "Case, scări, după renovare.",
  },
  {
    id: "constructii",
    name: "Construcții & Muncă fizică",
    short: "Construcții",
    blurb: "Zidărie, reparații, încărcări.",
  },
  {
    id: "gradinarit",
    name: "Grădinărit & Exterior",
    short: "Grădinărit",
    blurb: "Cosit, tăieri, curte.",
  },
  {
    id: "casnic",
    name: "Ajutor casnic",
    short: "Casnic",
    blurb: "Casă, cumpărături, îngrijire.",
  },
  {
    id: "altele",
    name: "Altele",
    short: "Altele",
    blurb: "Orice job scurt, plătit pe loc.",
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function categoryName(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id;
}

export function isCategoryId(value: string): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}
