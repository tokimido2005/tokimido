/**
 * Public pages that also exist in Russian under /ru (for Google: a Russian
 * search gets a Russian page). Private pages (account, CV…) have one address.
 */
const RU_TWINS = [/^\/$/, /^\/angajare\/?$/, /^\/lucru\/[^/]+\/?$/, /^\/c\/[^/]+\/?$/, /^\/r\/[^/]+\/?$/];

export function isRuPath(path: string) {
  return path === "/ru" || path.startsWith("/ru/");
}

/** The /ru address of a Romanian page, or null when it has no Russian twin. */
export function ruPathFor(path: string): string | null {
  if (isRuPath(path)) return path;
  if (!RU_TWINS.some((re) => re.test(path))) return null;
  return path === "/" ? "/ru" : `/ru${path}`;
}

/** The Romanian address of a /ru page. */
export function roPathFor(path: string): string {
  if (!isRuPath(path)) return path;
  const rest = path.slice(3);
  return rest === "" || rest === "/" ? "/" : rest;
}

/** Russian names of the regions, for /ru titles (the data keeps Romanian). */
export const RAION_RU: Record<string, string> = {
  "Chișinău": "Кишинёв",
  "Bălți": "Бельцы",
  "Anenii Noi": "Новые Анены",
  "Basarabeasca": "Бессарабка",
  "Briceni": "Бричаны",
  "Cahul": "Кагул",
  "Cantemir": "Кантемир",
  "Călărași": "Калараш",
  "Căușeni": "Каушаны",
  "Cimișlia": "Чимишлия",
  "Criuleni": "Криуляны",
  "Dondușeni": "Дондюшаны",
  "Drochia": "Дрокия",
  "Dubăsari": "Дубоссары",
  "Edineț": "Единцы",
  "Fălești": "Фалешты",
  "Florești": "Флорешты",
  "Glodeni": "Глодяны",
  "Hîncești": "Хынчешты",
  "Ialoveni": "Яловены",
  "Leova": "Леова",
  "Nisporeni": "Ниспорены",
  "Ocnița": "Окница",
  "Orhei": "Оргеев",
  "Rezina": "Резина",
  "Rîșcani": "Рышканы",
  "Sîngerei": "Сынжерей",
  "Soroca": "Сороки",
  "Strășeni": "Страшены",
  "Șoldănești": "Шолданешты",
  "Ștefan Vodă": "Штефан-Водэ",
  "Taraclia": "Тараклия",
  "Telenești": "Теленешты",
  "Ungheni": "Унгены",
  "UTA Găgăuzia": "Гагаузия",
};

export function raionLabel(raion: string, locale: string) {
  return locale === "ru" ? (RAION_RU[raion] ?? raion) : raion;
}
