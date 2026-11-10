import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Bell, BellOff, Check, MapPin, Send, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Combobox } from "@/components/combobox";
import { subscribePush } from "@/components/push-prompt";
import { getMyAlerts, listAlertMatches, saveMyAlerts, type AlertMatch, type MyAlerts } from "@/lib/alerts";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CATEGORIES } from "@/lib/categories";
import { OFFICIAL_CATEGORIES } from "@/lib/job-kinds";
import { RAION_NAMES } from "@/lib/moldova";
import { updatePushPrefs } from "@/lib/push";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";
import { askNotifications } from "@/components/notify-ask";
import { cn, formatMdl } from "@/lib/utils";

export const Route = createFileRoute("/alerte")({
  head: () => seoHead("Alertele mele", "Primește anunțurile noi potrivite pentru tine.", { noindex: true }),
  component: AlertsPage,
});

function AlertsPage() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<MyAlerts | null>(null);
  const [matches, setMatches] = useState<AlertMatch[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState("");

  useEffect(() => {
    if (!user) return;
    getMyAlerts()
      .then(setData)
      .catch(() => toast.error(t("home.loadError")));
    listAlertMatches()
      .then(setMatches)
      .catch(() => setMatches([]));
  }, [user, t]);

  // Telegram linked from the notifications window: show it as on right away.
  useEffect(() => {
    const refresh = () => {
      getMyAlerts()
        .then((fresh) => setData((d) => (d ? { ...d, telegramLinked: fresh.telegramLinked, pushDevices: fresh.pushDevices, via_telegram: fresh.telegramLinked ? true : d.via_telegram } : fresh)))
        .catch(() => {});
    };
    window.addEventListener("rbt-notify-changed", refresh);
    return () => window.removeEventListener("rbt-notify-changed", refresh);
  }, []);

  if (isPending) return <Shell><main className="mx-auto max-w-2xl px-4 py-16"><div className="h-64 animate-pulse rounded-[32px] bg-white/40" /></main></Shell>;
  if (!user) return <Navigate to="/login" search={{ next: "/alerte" }} />;

  const set = (patch: Partial<MyAlerts>) => setData((d) => (d ? { ...d, ...patch } : d));
  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    if (!data) return;
    if (data.kinds.length === 0) {
      toast.error(t("al.errKinds"));
      return;
    }
    setSaving(true);
    try {
      await saveMyAlerts({
        data: {
          raions: data.raions,
          categories: data.categories,
          kinds: data.kinds,
          via_push: data.via_push,
          via_telegram: data.via_telegram,
          paused: data.paused,
        },
      });
      toast.success(t("al.saved"));
      set({ exists: true });
      listAlertMatches().then(setMatches).catch(() => {});
    } catch (err) {
      toast.error(errorText(err, t, t("error.update")));
    } finally {
      setSaving(false);
    }
  }

  async function enablePush() {
    const ok = await subscribePush();
    if (!ok) {
      toast.error(t("push.denied"));
      return;
    }
    await updatePushPrefs({ data: { notify_push: true } }).catch(() => {});
    set({ via_push: true, pushDevices: Math.max(1, data?.pushDevices ?? 0) });
    toast.success(t("push.enabled"));
  }

  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("al.title")}</h1>
        <p className="mt-2 text-base text-muted">{t("al.lead")}</p>

        {!data ? (
          <div className="mt-6 h-64 animate-pulse rounded-[28px] bg-white/40" />
        ) : (
          <div className="mt-6 space-y-5">
            <button
              type="button"
              onClick={() => set({ paused: !data.paused })}
              data-testid="al-paused"
              aria-pressed={!data.paused}
              className={cn(
                "flex w-full items-center gap-4 rounded-[24px] p-5 text-left ring-2 transition-colors",
                data.paused ? "bg-navy/5 ring-navy/15" : "bg-emerald-600/10 ring-emerald-600/50",
              )}
            >
              {data.paused ? <BellOff className="size-8 text-muted" /> : <Bell className="size-8 text-emerald-700 dark:text-emerald-300" />}
              <span className="flex-1">
                <span className="block text-lg font-bold text-navy">{t(data.paused ? "al.off" : "al.on")}</span>
                <span className="block text-sm text-muted">{t(data.paused ? "al.offHint" : "al.onHint")}</span>
              </span>
            </button>

            <Card title={t("al.what")}>
              <div className="flex flex-wrap gap-2">
                {(["rapid", "oficial"] as const).map((k) => (
                  <Chip key={k} active={data.kinds.includes(k)} onClick={() => set({ kinds: toggleIn(data.kinds, k) })} testId={`al-kind-${k}`}>
                    {t(k === "rapid" ? "kind.rapid" : "kind.oficial")}
                  </Chip>
                ))}
              </div>
            </Card>

            <Card title={t("al.where")} hint={t("al.whereHint")}>
              <div className="flex flex-wrap gap-2" data-testid="al-raions">
                {data.raions.length === 0 ? (
                  <span className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-base font-semibold text-white">
                    <MapPin className="size-4" />
                    {t("al.allMoldova")}
                  </span>
                ) : (
                  data.raions.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => set({ raions: data.raions.filter((x) => x !== r) })}
                      className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-base font-semibold text-white"
                      aria-label={t("al.remove", { r })}
                    >
                      {r}
                      <X className="size-4" />
                    </button>
                  ))
                )}
              </div>
              <div className="mt-3 max-w-sm">
                <Combobox
                  value={pick}
                  onChange={(v) => {
                    setPick("");
                    if (v && !data.raions.includes(v)) set({ raions: [...data.raions, v] });
                  }}
                  options={RAION_NAMES.filter((r) => !data.raions.includes(r))}
                  placeholder={t("al.addRaion")}
                />
              </div>
              {data.raions.length > 0 ? (
                <button type="button" onClick={() => set({ raions: [] })} className="mt-2 h-10 text-sm font-semibold text-[#1d6fd8]">
                  {t("al.allMoldovaBtn")}
                </button>
              ) : null}
            </Card>

            <Card title={t("al.which")} hint={t("al.whichHint")}>
              <Chip active={data.categories.length === 0} onClick={() => set({ categories: [] })}>
                {t("search.all")}
              </Chip>
              {data.kinds.includes("rapid") ? (
                <>
                  <p className="mt-4 text-sm font-semibold text-muted">{t("kind.rapid")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <Chip key={c.id} active={data.categories.includes(c.id)} onClick={() => set({ categories: toggleIn(data.categories, c.id) })}>
                        {t(`cat.${c.id}`)}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : null}
              {data.kinds.includes("oficial") ? (
                <>
                  <p className="mt-4 text-sm font-semibold text-muted">{t("kind.oficial")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {OFFICIAL_CATEGORIES.map((c) => (
                      <Chip key={c.id} active={data.categories.includes(c.id)} onClick={() => set({ categories: toggleIn(data.categories, c.id) })}>
                        {t(`ocat.${c.id}`)}
                      </Chip>
                    ))}
                  </div>
                </>
              ) : null}
            </Card>

            <Card title={t("al.how")} hint={t("al.howHint")}>
              <div className="space-y-3">
                <Channel
                  icon={<Send className="size-6" />}
                  title="Telegram"
                  on={data.telegramLinked && data.via_telegram}
                  disabled={!data.telegramLinked}
                  onToggle={() => set({ via_telegram: !data.via_telegram })}
                  sub={data.telegramLinked ? t("al.tgOn") : t("al.tgNotLinked")}
                  testId="al-tg"
                />
                {!data.telegramLinked ? (
                  <button
                    type="button"
                    onClick={() => askNotifications("telegram")}
                    className="ml-1 inline-flex h-11 items-center rounded-full bg-[#229ed9] px-4 text-sm font-semibold text-white"
                  >
                    {t("nt.connectTg")}
                  </button>
                ) : null}
                <Channel
                  icon={<Smartphone className="size-6" />}
                  title={t("al.browser")}
                  on={data.pushDevices > 0 && data.via_push}
                  onToggle={() => (data.pushDevices > 0 ? set({ via_push: !data.via_push }) : void enablePush())}
                  sub={data.pushDevices > 0 ? t("al.pushOn") : t("al.pushOff")}
                  testId="al-push"
                />
              </div>
            </Card>

            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              data-testid="al-save"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-brand text-lg font-bold text-white disabled:opacity-60"
            >
              <Check className="size-5" />
              {saving ? t("cv.saving") : t("al.save")}
            </button>

            <section className="pt-4" data-testid="al-matches">
              <h2 className="text-xl font-semibold text-navy">{t("al.matches")}</h2>
              {!data.exists ? (
                <p className="mt-2 text-base text-muted">{t("al.matchesFirst")}</p>
              ) : matches === null ? (
                <div className="mt-3 h-24 animate-pulse rounded-2xl bg-white/40" />
              ) : matches.length === 0 ? (
                <p className="mt-2 text-base text-muted">{t("al.noMatches")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <Link
                        to="/jobs/$id"
                        params={{ id: String(m.id) }}
                        className="block rounded-2xl bg-white/60 p-4 ring-1 ring-navy/8 hover:bg-white/90 dark:bg-white/8"
                      >
                        <span className="block text-base font-semibold text-navy">{m.title}</span>
                        <span className="text-sm text-muted">
                          {[m.company, m.locality || m.raion, m.payment_mdl ? formatMdl(m.payment_mdl) : ""].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </Shell>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] p-5 glass">
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      {hint ? <p className="mt-0.5 text-sm text-muted">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        "min-h-11 rounded-full px-4 text-base font-medium",
        active ? "bg-brand text-white" : "bg-white/60 text-navy ring-1 ring-navy/12 dark:bg-white/10",
      )}
    >
      {active ? <Check className="mr-1 inline size-4" /> : null}
      {children}
    </button>
  );
}

function Channel({
  icon,
  title,
  sub,
  on,
  disabled,
  onToggle,
  testId,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      data-testid={testId}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/60 p-3 text-left ring-1 ring-navy/10 disabled:opacity-60 dark:bg-white/8"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-navy/8 text-navy">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-navy">{title}</span>
        <span className="block text-sm text-muted">{sub}</span>
      </span>
      <span className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors", on ? "bg-emerald-600" : "bg-navy/20")}>
        <span className={cn("absolute top-1 size-6 rounded-full bg-white shadow transition-all", on ? "left-7" : "left-1")} />
      </span>
    </button>
  );
}
