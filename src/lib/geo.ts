import { RAION_NAMES } from "@/lib/moldova";

/** Approximate centroids for Moldova raions — used only for “near me” and map pan. */
export const RAION_COORDS: Record<string, { lat: number; lng: number }> = {
  "Chișinău": { lat: 47.0105, lng: 28.8638 },
  "Bălți": { lat: 47.7619, lng: 27.9286 },
  "Anenii Noi": { lat: 46.8786, lng: 29.1481 },
  Basarabeasca: { lat: 46.3317, lng: 28.9681 },
  Briceni: { lat: 48.3564, lng: 27.0814 },
  Cahul: { lat: 45.9042, lng: 28.1944 },
  Cantemir: { lat: 46.2775, lng: 28.2008 },
  "Călărași": { lat: 47.2556, lng: 28.3097 },
  "Căușeni": { lat: 46.6369, lng: 29.4119 },
  "Cimișlia": { lat: 46.52, lng: 28.7842 },
  Criuleni: { lat: 47.2144, lng: 29.1592 },
  "Dondușeni": { lat: 48.2425, lng: 27.61 },
  Drochia: { lat: 48.0356, lng: 27.8161 },
  "Dubăsari": { lat: 47.2631, lng: 29.1608 },
  "Edineț": { lat: 48.1681, lng: 27.305 },
  "Fălești": { lat: 47.5761, lng: 27.7128 },
  "Florești": { lat: 47.8933, lng: 28.3014 },
  Glodeni: { lat: 47.7706, lng: 27.5144 },
  "Hîncești": { lat: 46.8256, lng: 28.5908 },
  Ialoveni: { lat: 46.9431, lng: 28.7775 },
  Leova: { lat: 46.4822, lng: 28.255 },
  Nisporeni: { lat: 47.0814, lng: 28.1783 },
  "Ocnița": { lat: 48.3814, lng: 27.4381 },
  Orhei: { lat: 47.3831, lng: 28.8231 },
  Rezina: { lat: 47.7492, lng: 28.9625 },
  "Rîșcani": { lat: 47.9575, lng: 27.5539 },
  "Sîngerei": { lat: 47.6364, lng: 28.1419 },
  Soroca: { lat: 48.1566, lng: 28.2849 },
  "Strășeni": { lat: 47.1414, lng: 28.6075 },
  "Șoldănești": { lat: 47.8161, lng: 28.7972 },
  "Ștefan Vodă": { lat: 46.5153, lng: 29.6631 },
  Taraclia: { lat: 45.9, lng: 28.6689 },
  "Telenești": { lat: 47.5028, lng: 28.3656 },
  Ungheni: { lat: 47.2106, lng: 27.8006 },
  "UTA Găgăuzia": { lat: 46.3047, lng: 28.6569 },
};

export const CHISINAU = RAION_COORDS["Chișinău"]!;

/** Generous Moldova bbox (includes Transnistria / border towns). */
export const MD_BOUNDS = {
  minLat: 45.2,
  maxLat: 48.7,
  minLng: 26.4,
  maxLng: 30.4,
};

export type GeoPoint = { lat: number; lng: number };

export function isInMoldova(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= MD_BOUNDS.minLat &&
    lat <= MD_BOUNDS.maxLat &&
    lng >= MD_BOUNDS.minLng &&
    lng <= MD_BOUNDS.maxLng
  );
}

export function clampToMoldova(lat: number, lng: number): GeoPoint {
  return {
    lat: Math.min(MD_BOUNDS.maxLat, Math.max(MD_BOUNDS.minLat, lat)),
    lng: Math.min(MD_BOUNDS.maxLng, Math.max(MD_BOUNDS.minLng, lng)),
  };
}

export function raionCenter(raion?: string | null): GeoPoint {
  if (raion && RAION_COORDS[raion]) return RAION_COORDS[raion];
  return CHISINAU;
}

/** Round to ~0.1 m and reject incomplete / out-of-country pins. */
export function normalizeJobGeo(
  lat?: number | null,
  lng?: number | null,
): GeoPoint | null {
  const hasLat = lat != null && Number.isFinite(lat);
  const hasLng = lng != null && Number.isFinite(lng);
  if (!hasLat && !hasLng) return null;
  if (!hasLat || !hasLng) throw new Error("Locația pe hartă este incompletă");
  const point = {
    lat: Math.round(Number(lat) * 1e6) / 1e6,
    lng: Math.round(Number(lng) * 1e6) / 1e6,
  };
  if (!isInMoldova(point.lat, point.lng)) {
    throw new Error("Alege un punct pe teritoriul Republicii Moldova");
  }
  return point;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function nearestRaion(lat: number, lng: number): string {
  let best = RAION_NAMES[0] ?? "Chișinău";
  let bestD = Infinity;
  for (const name of RAION_NAMES) {
    const c = RAION_COORDS[name];
    if (!c) continue;
    const d = haversineKm(lat, lng, c.lat, c.lng);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

export function requestBrowserRaion(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(nearestRaion(pos.coords.latitude, pos.coords.longitude)),
      () => reject(new Error("geo")),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

export function googleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
