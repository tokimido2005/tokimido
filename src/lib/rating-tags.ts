/**
 * Quick tags offered in the rating dialog. Ids are stored in ratings.tags;
 * labels live in i18n under `rtag.<id>`. Which list is shown depends on who
 * is being rated and on the stars (4–5 → good, 1–3 → bad).
 */
export const WORKER_TAGS = {
  good: ["punctual", "hardworking", "polite", "fast", "hireAgain"],
  bad: ["late", "sloppy", "rude", "leftEarly"],
} as const;

export const POSTER_TAGS = {
  good: ["paidOnTime", "clearTask", "politeBoss", "goodConditions", "workAgain"],
  bad: ["paidLate", "taskDiffered", "rudeBoss", "badConditions"],
} as const;

export type RatedRole = "worker" | "poster";

export const GOOD_TAGS = new Set<string>([...WORKER_TAGS.good, ...POSTER_TAGS.good]);

export function tagsFor(role: RatedRole, stars: number): readonly string[] {
  const list = role === "worker" ? WORKER_TAGS : POSTER_TAGS;
  if (stars <= 0) return [];
  return stars >= 4 ? list.good : list.bad;
}

export function allowedTags(role: RatedRole): Set<string> {
  const list = role === "worker" ? WORKER_TAGS : POSTER_TAGS;
  return new Set<string>([...list.good, ...list.bad]);
}

export const MAX_TAGS = 5;
export const COMMENT_MAX = 300;
