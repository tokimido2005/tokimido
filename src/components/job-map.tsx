import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Crosshair, Lock, MapPin, Minus, Navigation, Plus, X } from "lucide-react";
import { getJobExactLocation } from "@/lib/jobs";
import {
  CHISINAU,
  clampToMoldova,
  googleMapsUrl,
  isInMoldova,
  raionCenter,
  type GeoPoint,
} from "@/lib/geo";
import { useT } from "@/lib/locale";

const MIN_Z = 7;
const MAX_Z = 18;
const TILE = 256;

function project(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n;
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): GeoPoint {
  const n = 2 ** zoom;
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

function tileUrl(z: number, x: number, y: number, dark: boolean) {
  const n = 2 ** z;
  const wx = ((x % n) + n) % n;
  const host = ["a", "b", "c"][Math.abs(wx + y) % 3];
  const style = dark ? "dark_all" : "rastertiles/voyager";
  return `https://${host}.basemaps.cartocdn.com/${style}/${z}/${wx}/${y}.png`;
}

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function MapCanvas({
  center,
  zoom,
  pin,
  onCenterChange,
  onZoomChange,
  onPick,
  interactive = true,
}: {
  center: GeoPoint;
  zoom: number;
  pin: GeoPoint | null;
  onCenterChange?: (c: GeoPoint) => void;
  onZoomChange?: (z: number) => void;
  onPick?: (p: GeoPoint) => void;
  interactive?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 320, h: 224 });
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);
  const dark = useDark();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = Math.min(MAX_Z, Math.max(MIN_Z, zoom + (e.deltaY > 0 ? -1 : 1)));
      onZoomChange?.(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, zoom, onZoomChange]);

  const p = project(center.lat, center.lng, zoom);
  const worldX = p.x * TILE;
  const worldY = p.y * TILE;
  const left = worldX - size.w / 2;
  const top = worldY - size.h / 2;
  const x0 = Math.floor(left / TILE);
  const y0 = Math.floor(top / TILE);
  const x1 = Math.floor((left + size.w) / TILE);
  const y1 = Math.floor((top + size.h) / TILE);
  const tiles: Array<{ key: string; src: string; left: number; top: number }> = [];
  const n = 2 ** zoom;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= n) continue;
      tiles.push({
        key: `${zoom}/${x}/${y}/${dark ? "d" : "l"}`,
        src: tileUrl(zoom, x, y, dark),
        left: x * TILE - left,
        top: y * TILE - top,
      });
    }
  }

  let pinStyle: { left: number; top: number } | null = null;
  if (pin) {
    const pp = project(pin.lat, pin.lng, zoom);
    pinStyle = {
      left: pp.x * TILE - left,
      top: pp.y * TILE - top,
    };
  }

  function clientToLatLng(clientX: number, clientY: number): GeoPoint {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    return unproject((left + px) / TILE, (top + py) / TILE, zoom);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      cx: center.lat,
      cy: center.lng,
      moved: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 8) return;
    d.moved = true;
    const origin = project(d.cx, d.cy, zoom);
    const next = unproject(origin.x - dx / TILE, origin.y - dy / TILE, zoom);
    onCenterChange?.(clampToMoldova(next.lat, next.lng));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d.moved || !onPick) return;
    pickAt(e.clientX, e.clientY);
  }

  function pickAt(clientX: number, clientY: number) {
    if (!onPick) return;
    const point = clientToLatLng(clientX, clientY);
    if (!isInMoldova(point.lat, point.lng)) return;
    onPick(point);
    onCenterChange?.(point);
  }

  function zoomBy(delta: number) {
    const next = Math.min(MAX_Z, Math.max(MIN_Z, zoom + delta));
    onZoomChange?.(next);
  }

  return (
    <div
      ref={wrapRef}
      data-testid="map-canvas"
      className="job-map relative h-56 w-full touch-none overflow-hidden rounded-2xl bg-navy/10 sm:h-64"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => {
        if (!interactive || !onPick) return;
        if (drag.current?.moved) return;
        pickAt(e.clientX, e.clientY);
      }}
    >
      {tiles.map((t) => (
        <img
          key={t.key}
          src={t.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none"
          style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
        />
      ))}
      {pinStyle ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
          style={{ left: pinStyle.left, top: pinStyle.top }}
          data-testid="map-pin"
        >
          <MapPin className="size-9 text-orange drop-shadow-md" fill="currentColor" strokeWidth={1.6} />
        </div>
      ) : null}
      {interactive ? (
        <div
          className="absolute top-2 right-2 z-20 flex flex-col gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl bg-white/80 text-navy shadow-sm backdrop-blur-md dark:bg-navy-deep/80"
            onClick={() => zoomBy(1)}
            aria-label="+"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl bg-white/80 text-navy shadow-sm backdrop-blur-md dark:bg-navy-deep/80"
            onClick={() => zoomBy(-1)}
            aria-label="-"
          >
            <Minus className="size-4" />
          </button>
        </div>
      ) : null}
      <p className="pointer-events-none absolute bottom-1.5 left-2 z-10 text-[10px] text-navy/70 dark:text-white/55">
        © OpenStreetMap © CARTO
      </p>
    </div>
  );
}

export function MapPicker({
  value,
  onChange,
  raion,
}: {
  value: GeoPoint | null;
  onChange: (next: GeoPoint | null) => void;
  raion?: string;
}) {
  const { t } = useT();
  const [showMap, setShowMap] = useState(false);
  const [center, setCenter] = useState<GeoPoint>(() => (value ? value : raionCenter(raion)));
  const [zoom, setZoom] = useState(value ? 15 : 12);
  const [geoErr, setGeoErr] = useState<string | null>(null);

  useEffect(() => {
    if (value) return;
    const next = raionCenter(raion);
    setCenter(next);
    setZoom(raion === "Chișinău" ? 13 : 12);
  }, [raion, value]);

  function useMyLocation() {
    setGeoErr(null);
    if (!navigator.geolocation) {
      setGeoErr(t("map.geoFail"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isInMoldova(point.lat, point.lng)) {
          setGeoErr(t("map.outside"));
          return;
        }
        onChange(point);
        setCenter(point);
        setZoom(16);
        setShowMap(true);
      },
      () => setGeoErr(t("map.geoFail")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 },
    );
  }

  return (
    <div data-testid="map-picker">
      <label className="mb-3 flex items-center gap-2.5 text-sm font-medium text-navy">
        <input
          type="checkbox"
          checked={showMap}
          onChange={(e) => setShowMap(e.target.checked)}
          className="size-4 rounded accent-orange"
        />
        Arată locația pe hartă (opțional)
      </label>

      {showMap ? (
        <>
          <MapCanvas
            center={value ?? center}
            zoom={zoom}
            pin={value}
            onCenterChange={setCenter}
            onZoomChange={setZoom}
            onPick={(p) => {
              onChange(p);
              setGeoErr(null);
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-navy/8 px-3 text-xs font-semibold text-navy"
            >
              <Crosshair className="size-3.5" />
              {t("map.myLocation")}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-navy/8 px-3 text-xs font-semibold text-navy"
                data-testid="map-clear"
              >
                <X className="size-3.5" />
                {t("map.clear")}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <MapPin className="size-3.5" />
                {t("map.tap")}
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">Bifează ca să vezi harta. Nu ocupă loc până nu o activezi.</p>
      )}

      {value ? (
        <p className="mt-1.5 text-xs font-medium text-navy" data-testid="map-set">
          {t("map.set")}
        </p>
      ) : null}
      {geoErr ? <p className="mt-1.5 text-xs text-danger">{geoErr}</p> : null}
    </div>
  );
}

function ExactJobMap({ lat, lng }: GeoPoint) {
  const { t } = useT();
  const [center, setCenter] = useState<GeoPoint>({ lat, lng });
  const [zoom, setZoom] = useState(16);
  useEffect(() => {
    setCenter({ lat, lng });
    setZoom(16);
  }, [lat, lng]);
  return (
    <div>
      <MapCanvas
        center={center}
        zoom={zoom}
        pin={{ lat, lng }}
        onCenterChange={setCenter}
        onZoomChange={setZoom}
      />
      <a
        href={googleMapsUrl(lat, lng)}
        target="_blank"
        rel="noreferrer"
        data-testid="map-open-maps"
        className="mt-3 sheen inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold glass-navy sm:w-auto sm:px-5"
      >
        <Navigation className="size-4" />
        {t("map.open")}
      </a>
    </div>
  );
}

function PrivacyCard({ owner }: { owner?: boolean }) {
  const { t } = useT();
  return (
    <section className="mt-5 rounded-[28px] p-5 glass sm:p-6" data-testid="map-privacy">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-navy/8 text-navy">
          <Lock className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-navy">{t("map.locked")}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted" data-testid="map-privacy-msg">
            {owner ? t("map.privacyOwner") : t("map.privacy")}
          </p>
        </div>
      </div>
    </section>
  );
}

export function JobLocationBlock({
  jobId,
  hasGeo,
  signedIn,
  authPending,
  isOwner,
}: {
  jobId: number;
  hasGeo: boolean;
  signedIn: boolean;
  authPending?: boolean;
  isOwner: boolean;
}) {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [loc, setLoc] = useState<{ visible: true; lat: number; lng: number } | { visible: false } | "loading">(
    "loading",
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!hasGeo || !mounted) return;
    if (!signedIn) {
      setLoc({ visible: false });
      return;
    }
    let cancelled = false;
    setLoc("loading");
    getJobExactLocation({ data: { jobId } })
      .then((row) => {
        if (!cancelled) setLoc(row);
      })
      .catch(() => {
        if (!cancelled) setLoc({ visible: false });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, hasGeo, signedIn, mounted]);

  if (!hasGeo) return null;
  if (!mounted || authPending || loc === "loading") {
    return <div className="mt-5 h-28 animate-pulse rounded-[28px] bg-white/40 dark:bg-white/8" />;
  }
  if (!loc.visible) return <PrivacyCard />;

  return (
    <section className="mt-5 rounded-[28px] p-5 glass sm:p-6" data-testid="map-exact">
      <h2 className="text-lg font-semibold text-navy">{t("map.exact")}</h2>
      {isOwner ? <p className="mt-1 mb-3 text-sm text-muted">{t("map.privacyOwner")}</p> : <div className="mb-3" />}
      <ExactJobMap lat={loc.lat} lng={loc.lng} />
    </section>
  );
}
