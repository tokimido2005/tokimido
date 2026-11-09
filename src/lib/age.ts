/** Age rules shared by client and server. */
export const MIN_AGE = 16;
export const ADULT_AGE = 18;
/** Rapid categories that are heavy physical work: 18+ by default. */
export const HEAVY_CATEGORIES = ["mutari", "constructii"] as const;

/** Age reached in the current year (year of birth only, so it can be up to 1 year generous). */
export function ageFromYear(year: number | null | undefined) {
  if (!year) return null;
  return new Date().getFullYear() - year;
}

export function birthYearRange() {
  const now = new Date().getFullYear();
  return { min: now - 100, max: now - MIN_AGE };
}

export function isValidBirthYear(year: number) {
  const { min, max } = birthYearRange();
  return Number.isInteger(year) && year >= min && year <= max;
}
