/**
 * Keyword landing pages for quick jobs (kalîmuri). Each one is a filtered
 * list of open quick jobs with its own title and intro text, so Google has a
 * real page to show for searches like "lucru pe zi" or "lucru în weekend".
 * Texts live in i18n under land.<slug>.title / .desc / .p1 / .p2.
 */
export type Landing = {
  slug: string;
  when?: "today" | "weekend";
};

export const LANDINGS: readonly Landing[] = [
  { slug: "azi", when: "today" },
  { slug: "weekend", when: "weekend" },
  { slug: "plata-zilnica" },
  { slug: "fara-experienta" },
  { slug: "studenti" },
];

export function findLanding(slug: string): Landing | null {
  return LANDINGS.find((l) => l.slug === slug) ?? null;
}

