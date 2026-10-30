import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Briefcase, Zap } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Combobox } from "@/components/combobox";
import { CaptchaField, type CaptchaValue } from "@/components/captcha-field";
import { CATEGORIES } from "@/lib/categories";
import {
  CONTRACT_TYPES,
  OFFICIAL_CATEGORIES,
  SCHEDULES,
  isJobKind,
  type JobKind,
} from "@/lib/job-kinds";
import { RAION_NAMES, localitiesFor } from "@/lib/moldova";
import { createJob } from "@/lib/jobs";
import { getProfileGate } from "@/lib/profile";
import { getMyAccess, getMonetizationPublic, type MonetizationAccess } from "@/lib/monetization";
import { useMoneyMode } from "@/lib/money-mode";
import { PaywallCard, UsageHint } from "@/components/paywall";
import { PhoneLocked } from "@/components/phone-verify";
import { MapPicker } from "@/components/job-map";
import { track } from "@/lib/analytics";
import { seoHead } from "@/lib/seo";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { combineDateTime, tomorrowDateInput } from "@/lib/utils";
import { useT } from "@/lib/locale";

type Search = { kind?: JobKind };

export const Route = createFileRoute("/post")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    kind: isJobKind(typeof s.kind === "string" ? s.kind : "") ? (s.kind as JobKind) : undefined,
  }),
  head: () => seoHead("Postez un anunț", "Publică lucru rapid sau angajare oficială pe Rabotaem.md."),
  component: PostJob,
});

function PostJob() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const { kind: kindFromUrl } = Route.useSearch();
  const { showPro, mode } = useMoneyMode();
  const [kind, setKind] = useState<JobKind | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>(CATEGORIES[0].id);
  const [oficialCat, setOficialCat] = useState<(typeof OFFICIAL_CATEGORIES)[number]["id"]>(
    OFFICIAL_CATEGORIES[0].id,
  );
  const [raion, setRaion] = useState("Chișinău");
  const [locality, setLocality] = useState("Centru");
  const [payment, setPayment] = useState("400");
  const [salary, setSalary] = useState("8000");
  const [negotiable, setNegotiable] = useState(false);
  const [duration, setDuration] = useState("2");
  const [unit, setUnit] = useState<"hours" | "minutes">("hours");
  const [people, setPeople] = useState("2");
  const [peopleCustom, setPeopleCustom] = useState("6");
  const [openings, setOpenings] = useState("1");
  const [workDate, setWorkDate] = useState(tomorrowDateInput);
  const [workTime, setWorkTime] = useState("09:00");
  const [company, setCompany] = useState("");
  const [contract, setContract] = useState<(typeof CONTRACT_TYPES)[number]>("nedeterminat");
  const [schedule, setSchedule] = useState<(typeof SCHEDULES)[number]>("full");
  const [phone, setPhone] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [gate, setGate] = useState<{ complete: boolean; verified: boolean; phone: string } | null>(null);
  const [access, setAccess] = useState<MonetizationAccess | undefined>(undefined);

  const localities = useMemo(() => localitiesFor(raion), [raion]);

  useEffect(() => {
    if (!user) {
      setGate(null);
      return;
    }
    let cancelled = false;
    getProfileGate()
      .then((g) => {
        if (!cancelled) {
          setGate({ complete: g.complete, verified: g.verified, phone: g.phone });
          if (g.phone) setPhone(g.phone);
        }
      })
      .catch(() => {
        if (!cancelled) setGate({ complete: false, verified: false, phone: "" });
      });
    getMyAccess({ data: { t: Date.now() } })
      .then((row) => {
        if (!cancelled) setAccess(row);
      })
      .catch(async () => {
        try {
          const settings = await getMonetizationPublic({ data: { t: Date.now() } });
          if (cancelled) return;
          setAccess({
            ...settings,
            isPro: false,
            isAdmin: false,
            proUntil: null,
            jobsUsed: 0,
            appliesUsed: 0,
            canPost: settings.mode === "free",
            canApply: settings.mode === "free",
          });
        } catch {
          if (!cancelled) setAccess(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, mode]);

  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }
  if (!user) return <Navigate to="/login" search={{ next: "/post" }} />;
  if (gate === null) {
    return (
      <Shell>
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }
  if (!gate.complete) return <Navigate to="/complete" search={{ next: "/post" }} />;
  if (!gate.verified) return <Navigate to="/verify" search={{ next: "/post" }} />;
  if (access === undefined) {
    return (
      <Shell>
        <main className="mx-auto max-w-2xl px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }

  const posterName = user.displayName ?? user.primaryEmail ?? "Utilizator";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError(null);
    if (!captcha) {
      setBusy(false);
      setError(t("captcha.required"));
      return;
    }
    try {
      if (kind === "oficial") {
        const res = await createJob({
          data: {
            kind: "oficial",
            title: title.trim(),
            description: description.trim(),
            category: oficialCat,
            raion,
            locality,
            payment_mdl: negotiable ? 0 : Math.max(0, Number(salary) || 0),
            duration_minutes: 0,
            people_needed: Math.max(1, Number(openings) || 1),
            poster_name: posterName,
            starts_at: "",
            captcha,
            geo_lat: pin?.lat ?? null,
            geo_lng: pin?.lng ?? null,
            company: company.trim(),
            contract_type: contract,
            schedule,
            salary_period: "month",
          },
        });
        toast.success(t("toast.posted"));
        track("job_post", { id: res.id });
        await navigate({ to: "/jobs/$id", params: { id: String(res.id) } });
        return;
      }
      const payment_mdl = Number(payment);
      const dur = Number(duration);
      const people_needed = people === "6+" ? Math.max(6, Number(peopleCustom) || 6) : Number(people);
      const duration_minutes = unit === "hours" ? Math.round(dur * 60) : Math.round(dur);
      if (!workDate || !workTime) {
        setBusy(false);
        setError("Data și ora sunt obligatorii");
        return;
      }
      const startsIso = combineDateTime(workDate, workTime);
      if (new Date(startsIso).getTime() <= Date.now()) {
        setBusy(false);
        setError("Alege o dată și o oră în viitor");
        return;
      }
      const res = await createJob({
        data: {
          kind: "rapid",
          title: title.trim(),
          description: description.trim(),
          category,
          raion,
          locality,
          payment_mdl,
          duration_minutes,
          people_needed,
          poster_name: posterName,
          starts_at: startsIso,
          captcha,
          geo_lat: pin?.lat ?? null,
          geo_lng: pin?.lng ?? null,
        },
      });
      toast.success(t("toast.posted"));
      track("job_post", { id: res.id });
      await navigate({ to: "/jobs/$id", params: { id: String(res.id) } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nu am putut publica anunțul";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {kind ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("post.pageTitle")}</h1>
            <p className="mt-2 text-sm text-muted">
              {showPro && access?.mode === "paid"
                ? t("pro.paidMode")
                : showPro && access?.mode === "freemium"
                  ? t("pro.freemiumMode", { jobs: access.freeJobLimit, apps: access.freeApplyLimit })
                  : t("post.pageLead")}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("kind.ask")}</h1>
            <p className="mt-2 text-sm text-muted">{t("kind.pick")}</p>
          </>
        )}

        {showPro && access && !access.canPost ? (
          <div className="mt-6">
            <PaywallCard access={access} action="post" />
          </div>
        ) : !kind ? (
          <section className="mt-6" data-testid="kind-picker">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                data-testid="kind-rapid"
                onClick={() => setKind("rapid")}
                className={
                  kindFromUrl === "rapid"
                    ? "rounded-[28px] p-5 text-left glass ring-2 ring-orange/50 transition-transform hover:-translate-y-0.5"
                    : "rounded-[28px] p-5 text-left glass transition-transform hover:-translate-y-0.5"
                }
              >
                <span className="grid size-11 place-items-center rounded-full bg-orange/15 text-orange-deep">
                  <Zap className="size-5" />
                </span>
                <p className="mt-4 text-lg font-semibold text-navy">{t("kind.rapid")}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("kind.rapidLead")}</p>
              </button>
              <button
                type="button"
                data-testid="kind-oficial"
                onClick={() => setKind("oficial")}
                className={
                  kindFromUrl === "oficial"
                    ? "rounded-[28px] p-5 text-left glass ring-2 ring-navy/30 transition-transform hover:-translate-y-0.5"
                    : "rounded-[28px] p-5 text-left glass transition-transform hover:-translate-y-0.5"
                }
              >
                <span className="grid size-11 place-items-center rounded-full bg-brand/12 text-navy">
                  <Briefcase className="size-5" />
                </span>
                <p className="mt-4 text-lg font-semibold text-navy">{t("kind.oficial")}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("kind.oficialLead")}</p>
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-navy/8 px-3 py-1 text-xs font-semibold text-navy">
                {kind === "oficial" ? t("kind.oficial") : t("kind.rapid")}
              </span>
              <button
                type="button"
                className="text-sm font-medium text-orange"
                onClick={() => {
                  setKind(null);
                  setError(null);
                }}
              >
                {t("kind.change")}
              </button>
            </div>
            <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4 rounded-[32px] p-5 glass sm:p-7">
              {kind === "oficial" ? (
                <>
                  <Field label={t("kind.company")} required>
                    <input
                      className="field"
                      required
                      minLength={2}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Ex: Market Plus SRL"
                    />
                  </Field>
                  <Field label={t("post.title")} required>
                    <input
                      className="field"
                      required
                      minLength={6}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Vânzător magazin alimentar"
                    />
                  </Field>
                  <Field label={t("post.description")} required>
                    <textarea
                      className="field min-h-32 py-3"
                      required
                      minLength={20}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("post.oficialDescHint")}
                    />
                  </Field>
                  <Field label={t("post.category")}>
                    <div className="flex flex-wrap gap-2">
                      {OFFICIAL_CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setOficialCat(c.id)}
                          className={
                            oficialCat === c.id
                              ? "h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white"
                              : "h-11 rounded-full bg-white/50 dark:bg-white/10 px-4 text-sm font-medium text-navy ring-1 ring-navy/8"
                          }
                        >
                          {t(`ocat.${c.id}`)}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              ) : (
                <>
                  <Field label={t("post.title")} required>
                    <input
                      className="field"
                      required
                      minLength={6}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Mutare canapea la etajul 3"
                    />
                  </Field>
                  <Field label={t("post.description")} required>
                    <textarea
                      className="field min-h-32 py-3"
                      required
                      minLength={20}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ce trebuie făcut, unde, cînd, ce e inclus."
                    />
                  </Field>
                  <Field label={t("post.category")}>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          className={
                            category === c.id
                              ? "h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white"
                              : "h-11 rounded-full bg-white/50 dark:bg-white/10 px-4 text-sm font-medium text-navy ring-1 ring-navy/8"
                          }
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("post.raion")}>
                  <Combobox
                    value={raion}
                    onChange={(v) => {
                      setRaion(v);
                      const next = localitiesFor(v);
                      setLocality(next[0] ?? "");
                    }}
                    options={RAION_NAMES}
                    placeholder={t("search.allRaions")}
                  />
                </Field>
                <Field label={kind === "oficial" ? t("kind.city") : t("post.locality")}>
                  <Combobox
                    value={locality}
                    onChange={setLocality}
                    options={localities}
                    placeholder={t("search.allPlaces")}
                    allowCustom
                  />
                </Field>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-navy">{t("map.optional")}</p>
                <p className="mb-2 text-xs leading-relaxed text-muted">{t("map.hint")}</p>
                <MapPicker value={pin} onChange={setPin} raion={raion} />
              </div>
              {kind === "oficial" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("kind.salary")}>
                      <input
                        className="field tabular-nums"
                        type="number"
                        min={0}
                        disabled={negotiable}
                        value={negotiable ? "" : salary}
                        onChange={(e) => setSalary(e.target.value)}
                        placeholder="8000"
                      />
                    </Field>
                    <Field label={t("kind.openings")} required>
                      <input
                        className="field tabular-nums"
                        type="number"
                        min={1}
                        max={30}
                        required
                        value={openings}
                        onChange={(e) => setOpenings(e.target.value)}
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-navy">
                    <input
                      type="checkbox"
                      checked={negotiable}
                      onChange={(e) => setNegotiable(e.target.checked)}
                    />
                    {t("kind.salaryNegotiable")}
                  </label>
                  <Field label={t("kind.schedule")}>
                    <div className="flex flex-wrap gap-2">
                      {SCHEDULES.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSchedule(id)}
                          className={
                            schedule === id
                              ? "h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white"
                              : "h-11 rounded-full bg-white/50 dark:bg-white/10 px-4 text-sm font-medium text-navy ring-1 ring-navy/8"
                          }
                        >
                          {t(`schedule.${id}`)}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t("kind.contract")}>
                    <div className="flex flex-wrap gap-2">
                      {CONTRACT_TYPES.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setContract(id)}
                          className={
                            contract === id
                              ? "h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white"
                              : "h-11 rounded-full bg-white/50 dark:bg-white/10 px-4 text-sm font-medium text-navy ring-1 ring-navy/8"
                          }
                        >
                          {t(`contract.${id}`)}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("post.date")} required>
                      <input
                        className="field tabular-nums"
                        type="date"
                        required
                        min={toMinDate()}
                        value={workDate}
                        onChange={(e) => setWorkDate(e.target.value)}
                      />
                    </Field>
                    <Field label={t("post.time")} required>
                      <input
                        className="field tabular-nums"
                        type="time"
                        required
                        value={workTime}
                        onChange={(e) => setWorkTime(e.target.value)}
                      />
                    </Field>
                  </div>
                  <p className="text-xs text-muted">{t("post.whenHint")}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("post.pay")}>
                      <input
                        className="field tabular-nums"
                        type="number"
                        min={50}
                        required
                        value={payment}
                        onChange={(e) => setPayment(e.target.value)}
                      />
                    </Field>
                    <Field label={t("post.duration")}>
                      <div className="flex gap-2">
                        <input
                          className="field tabular-nums"
                          type="number"
                          min={1}
                          required
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                        />
                        <select
                          className="field w-28 px-2"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value as "hours" | "minutes")}
                        >
                          <option value="hours">{t("post.hours")}</option>
                          <option value="minutes">{t("post.minutes")}</option>
                        </select>
                      </div>
                    </Field>
                  </div>
                  <Field label={t("post.people")} required>
                    <div className="flex flex-wrap gap-2">
                      {["1", "2", "3", "4", "5", "6+"].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPeople(n)}
                          className={
                            people === n
                              ? "h-11 min-w-11 rounded-full bg-brand px-3.5 text-sm font-semibold text-white"
                              : "h-11 min-w-11 rounded-full bg-white/50 dark:bg-white/10 px-3.5 text-sm font-medium text-navy ring-1 ring-navy/8"
                          }
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    {people === "6+" ? (
                      <input
                        className="field mt-2 tabular-nums"
                        type="number"
                        min={6}
                        max={30}
                        value={peopleCustom}
                        onChange={(e) => setPeopleCustom(e.target.value)}
                      />
                    ) : null}
                  </Field>
                </>
              )}
              <Field label={t("apply.phone")}>
                <PhoneLocked phone={phone} />
                <p className="mt-1.5 text-xs text-muted">{t("verify.changeHint")}</p>
              </Field>
              <CaptchaField onChange={setCaptcha} />
              {access ? <UsageHint access={access} action="post" /> : null}
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                data-testid="post-publish"
                className="sheen flex h-14 w-full items-center justify-center rounded-full px-6 text-base font-semibold glass-orange disabled:opacity-60"
              >
                {busy ? t("post.publishing") : t("post.publish")}
              </button>
            </form>
          </>
        )}
        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/" hash="joburi" className="font-medium text-orange">
            {t("kind.tabRapid")}
          </Link>
          {" · "}
          <Link to="/angajare" className="font-medium text-orange">
            {t("kind.tabOficial")}
          </Link>
        </p>
      </main>
    </Shell>
  );
}

function toMinDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy">
        {label}
        {required ? <span className="text-orange"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
