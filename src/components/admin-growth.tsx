import { useEffect, useMemo, useState } from "react";
import { adminGrowthStats, type DayStats, type GrowthStats } from "@/lib/stats";
import { useT } from "@/lib/locale";
import { raionLabel } from "@/lib/lang-paths";
import { cn } from "@/lib/utils";

type Metric = "visitors" | "jobs" | "apps" | "selected" | "users";
const METRICS: Metric[] = ["visitors", "jobs", "apps", "selected", "users"];

function value(d: DayStats, m: Metric) {
  if (m === "jobs") return d.jobsRapid + d.jobsOficial;
  return d[m];
}

function sum(days: DayStats[], m: Metric) {
  return days.reduce((acc, d) => acc + value(d, m), 0);
}

/** Admin overview: growth over days, sources, places, searches. */
export function GrowthPanel() {
  const { t } = useT();
  const [data, setData] = useState<GrowthStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState<Metric>("visitors");

  useEffect(() => {
    adminGrowthStats()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!data) return <div className="mt-8 h-64 animate-pulse rounded-[24px] bg-white/40 dark:bg-white/8" />;

  const d = data.days;
  const today = d.slice(-1);
  const last7 = d.slice(-7);
  const prev7 = d.slice(-14, -7);
  const last30 = d.slice(-30);
  const prev30 = d.slice(-60, -30);

  return (
    <section className="mt-10" data-testid="growth-panel">
      <h2 className="text-2xl font-semibold tracking-tight text-navy">{t("stats.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("stats.lead")}</p>

      <div className="mt-4 overflow-x-auto rounded-[24px] glass">
        <table className="w-full min-w-[520px] text-sm" data-testid="growth-table">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">{t("stats.metric")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("stats.today")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("stats.d7")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("stats.d30")}</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{t(`stats.m.${m}`)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-navy">{sum(today, m)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-navy">
                  {sum(last7, m)} <Delta now={sum(last7, m)} before={sum(prev7, m)} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-navy">
                  {sum(last30, m)} <Delta now={sum(last30, m)} before={sum(prev30, m)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-subtle">{t("stats.deltaHint")}</p>

      <div className="mt-4 rounded-[24px] p-5 glass" data-testid="notify-share">
        <p className="font-semibold text-navy">{t("stats.notifyT")}</p>
        <p className="mt-1 text-sm text-muted">
          {t("stats.notifyLine", {
            any: data.notify.any,
            users: data.notify.users,
            pct: data.notify.users ? Math.round((data.notify.any / data.notify.users) * 100) : 0,
            tg: data.notify.telegram,
            push: data.notify.push,
          })}
        </p>
        <div className="mt-3 h-2 rounded-full bg-navy/8">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${data.notify.users ? (data.notify.any / data.notify.users) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="mt-6 rounded-[24px] p-5 glass">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                "h-9 rounded-full px-3 text-sm font-medium",
                metric === m ? "bg-brand text-white" : "bg-white/45 text-navy ring-1 ring-navy/8 dark:bg-white/8",
              )}
            >
              {t(`stats.m.${m}`)}
            </button>
          ))}
        </div>
        <BarChart days={last30} metric={metric} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ListCard
          title={t("stats.sources")}
          hint={t("stats.sourcesHint")}
          rows={data.sources.map((s) => ({ label: t(`stats.src.${s.source}`), value: s.visitors }))}
        />
        <ListCard
          title={t("stats.pages")}
          rows={data.pages.map((p) => ({ label: p.path, value: p.views, sub: t("stats.visitorsN", { n: p.visitors }) }))}
        />
        <ListCard
          title={t("stats.raions")}
          rows={data.raions.map((r) => ({
            label: raionLabel(r.raion, "ro"),
            value: r.jobs,
            sub: t("stats.appsN", { n: r.apps }),
          }))}
        />
        <ListCard
          title={t("stats.categories")}
          rows={data.categories.map((c) => ({
            label: `${t(c.kind === "oficial" ? `ocat.${c.category}` : `cat.${c.category}`)} · ${t(c.kind === "oficial" ? "kind.badgeOficial" : "kind.badgeRapid")}`,
            value: c.jobs,
          }))}
        />
        <ListCard
          title={t("stats.searches")}
          rows={data.searches.map((s) => ({
            label: s.q,
            value: s.n,
            sub: s.zero > 0 ? t("stats.zeroN", { n: s.zero }) : undefined,
          }))}
        />
        <ListCard
          title={t("stats.zero")}
          hint={t("stats.zeroHint")}
          rows={data.zeroSearches.map((s) => ({ label: s.q, value: s.n }))}
          accent
        />
      </div>
    </section>
  );
}

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0) return now > 0 ? <span className="ml-1 text-xs font-semibold text-emerald-600">{"↑"}</span> : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="ml-1 text-xs text-muted">0%</span>;
  return (
    <span className={cn("ml-1 text-xs font-semibold", pct > 0 ? "text-emerald-600" : "text-danger")}>
      {pct > 0 ? `+${pct}%` : `${pct}%`}
    </span>
  );
}

function BarChart({ days, metric }: { days: DayStats[]; metric: Metric }) {
  const { t } = useT();
  const values = useMemo(() => days.map((d) => value(d, metric)), [days, metric]);
  const max = Math.max(1, ...values);
  return (
    <div className="mt-5" data-testid="growth-chart">
      <div className="flex h-40 items-end gap-[3px]">
        {days.map((d, i) => (
          <div
            key={d.day}
            className="group relative flex-1"
            style={{ height: "100%", display: "flex", alignItems: "flex-end" }}
            title={`${d.day.slice(8, 10)}.${d.day.slice(5, 7)}: ${values[i]}`}
          >
            <div
              className={cn("w-full rounded-t-[4px]", values[i] > 0 ? "bg-orange" : "bg-navy/10")}
              style={{ height: `${Math.max(values[i] > 0 ? 4 : 2, (values[i] / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
        <span>{`${days[0].day.slice(8, 10)}.${days[0].day.slice(5, 7)}`}</span>
        <span>
          {t("stats.max")}: {max === 1 && values.every((v) => v === 0) ? 0 : max}
        </span>
        <span>{t("stats.today")}</span>
      </div>
    </div>
  );
}

function ListCard({
  title,
  hint,
  rows,
  accent = false,
}: {
  title: string;
  hint?: string;
  rows: Array<{ label: string; value: number; sub?: string }>;
  accent?: boolean;
}) {
  const { t } = useT();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="rounded-[24px] p-5 glass">
      <p className="font-semibold text-navy">{title}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("stats.empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-navy">{r.label}</span>
                <span className="shrink-0 tabular-nums font-semibold text-navy">
                  {r.value}
                  {r.sub ? <span className="ml-1.5 text-xs font-normal text-muted">{r.sub}</span> : null}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-navy/8">
                <div
                  className={cn("h-full rounded-full", accent ? "bg-danger/70" : "bg-orange/80")}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
