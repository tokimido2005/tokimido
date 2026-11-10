import type { CategoryId } from "@/lib/categories";
import { isExpired, type JobStatusFields } from "@/lib/job-status";

/**
 * Ready-made starts for the most common quick jobs. Texts live in i18n under
 * tpl.<id>.t (title) and tpl.<id>.d (description); pay and place stay empty
 * for the poster to fill in.
 */
export type JobTemplate = { id: string; category: CategoryId; people: number; hours: number };

export const JOB_TEMPLATES: readonly JobTemplate[] = [
  { id: "mutare", category: "mutari", people: 2, hours: 4 },
  { id: "descarcare", category: "mutari", people: 2, hours: 2 },
  { id: "curatenieRenovare", category: "curatenie", people: 2, hours: 6 },
  { id: "curatenieApartament", category: "curatenie", people: 1, hours: 4 },
  { id: "cosit", category: "gradinarit", people: 1, hours: 3 },
  { id: "lemne", category: "gradinarit", people: 1, hours: 4 },
  { id: "constructie", category: "constructii", people: 2, hours: 8 },
  { id: "sapat", category: "gradinarit", people: 1, hours: 4 },
];

/** Finished, expired or cancelled listings can be posted again as a copy. */
export function canRepost(job: JobStatusFields) {
  return job.status !== "open" || isExpired(job);
}
