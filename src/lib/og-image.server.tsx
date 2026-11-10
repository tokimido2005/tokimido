import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import latin600 from "@/assets/og/inter-latin-600-normal.woff?inline";
import latin800 from "@/assets/og/inter-latin-800-normal.woff?inline";
import ext600 from "@/assets/og/inter-latin-ext-600-normal.woff?inline";
import ext800 from "@/assets/og/inter-latin-ext-800-normal.woff?inline";
import cyr600 from "@/assets/og/inter-cyrillic-600-normal.woff?inline";
import cyr800 from "@/assets/og/inter-cyrillic-800-normal.woff?inline";
import logo from "@/assets/og/logo-light.png?inline";
import type { Job } from "@/lib/jobs";
import { translate } from "@/lib/i18n";

/**
 * Preview image (1200×630) for a job: what Viber, Telegram, Facebook and
 * WhatsApp show under a shared link. Rendered on the server with satori
 * (layout → SVG) and resvg (SVG → PNG).
 */
const W = 1200;
const H = 630;
const FAMILY = "Inter-latin, Inter-latin-ext, Inter-cyrillic";

function bytes(dataUrl: string) {
  const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

let fontCache: Parameters<typeof satori>[1]["fonts"] | null = null;
function fonts() {
  fontCache ??= [
    ["latin", 600, latin600],
    ["latin", 800, latin800],
    ["latin-ext", 600, ext600],
    ["latin-ext", 800, ext800],
    ["cyrillic", 600, cyr600],
    ["cyrillic", 800, cyr800],
  ].map(([subset, weight, data]) => ({
    name: `Inter-${subset}`,
    data: bytes(data as string),
    weight: weight as 600 | 800,
    style: "normal" as const,
  }));
  return fontCache;
}

function shorten(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function whenText(startsAt: string | null | undefined) {
  if (!startsAt) return "";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Chisinau", weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Chisinau", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${day}, ${time}`;
}

function mdl(n: number) {
  return `${new Intl.NumberFormat("ro-RO").format(n)} MDL`;
}

export function jobImageKey(job: Job) {
  return [job.id, job.title, job.payment_mdl, job.details?.salary_max ?? 0, job.locality, job.raion, job.starts_at, job.kind, job.company].join("|");
}

export async function renderJobImage(job: Job): Promise<Buffer> {
  const official = job.kind === "oficial";
  const place = [job.locality, job.raion].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
  const pay = official
    ? job.payment_mdl > 0
      ? `${mdl(job.payment_mdl)}${(job.details?.salary_max ?? 0) > job.payment_mdl ? ` – ${mdl(job.details!.salary_max)}` : ""} / lună`
      : translate("ro", "kind.salaryNegotiable")
    : mdl(job.payment_mdl);
  const second = official ? [job.company, place].filter(Boolean).join(" · ") : [place, whenText(job.starts_at)].filter(Boolean).join(" · ");
  const title = shorten(job.title, 64);

  const tree = (
    <div
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 64px",
        backgroundImage: "linear-gradient(135deg, #071a33 0%, #0b2548 55%, #163a66 100%)",
        color: "#ffffff",
        fontFamily: FAMILY,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src={logo} width={320} height={80} />
        <div
          style={{
            display: "flex",
            padding: "10px 26px",
            borderRadius: 999,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: 1,
            backgroundColor: official ? "#ffffff" : "#f15a22",
            color: official ? "#0b2548" : "#ffffff",
          }}
        >
          {official ? "ANGAJARE" : "KALÎM · LUCRU PE LOC"}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: title.length > 42 ? 56 : 74, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>
          {title}
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: official ? 54 : 72, fontWeight: 800, color: "#ff6b2c" }}>{pay}</div>
        {second ? (
          <div style={{ display: "flex", marginTop: 14, fontSize: 34, fontWeight: 600, color: "#c9d8ea" }}>{shorten(second, 64)}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30, fontWeight: 600 }}>
        <div style={{ display: "flex", color: "#ffffff" }}>Aplică pe rabotaem.md</div>
        <div style={{ display: "flex", color: "#8fa6c2" }}>Fără comision</div>
      </div>
    </div>
  );

  const svg = await satori(tree, { width: W, height: H, fonts: fonts()! });
  return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
}
