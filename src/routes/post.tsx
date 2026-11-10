import { errorText } from "@/lib/i18n";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Briefcase, Zap } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Combobox } from "@/components/combobox";
import { CaptchaField, type CaptchaValue } from "@/components/captcha-field";
import { CATEGORIES, isCategoryId } from "@/lib/categories";
import {
  CONTRACT_TYPES,
  OFFICIAL_CATEGORIES,
  SCHEDULES,
  isJobKind,
  type JobKind,
} from "@/lib/job-kinds";
import { RAION_NAMES, localitiesFor } from "@/lib/moldova";
import { createJob, getJob, getJobExactLocation } from "@/lib/jobs";
import { getProfileGate } from "@/lib/profile";
import { getMyAccess, getMonetizationPublic, type MonetizationAccess } from "@/lib/monetization";
import { useMoneyMode } from "@/lib/money-mode";
import { PaywallCard, UsageHint } from "@/components/paywall";
import { PhoneLocked } from "@/components/phone-verify";
import { MapPicker } from "@/components/job-map";
import { track } from "@/lib/analytics";
import { seoHead } from "@/lib/seo";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { combineDateTime, formatJobTime, tomorrowDateInput } from "@/lib/utils";
import { useT } from "@/lib/locale";
import { CV_LANGS, JOB_EDUCATION, JOB_EXPERIENCE, normalizeJobDetails } from "@/lib/cv-shared";
import { JOB_TEMPLATES, type JobTemplate } from "@/lib/job-templates";
import { HEAVY_CATEGORIES } from "@/lib/age";
import { getMyCompany } from "@/lib/companies";

type Search = { kind?: JobKind; from?: number };

export const Route = createFileRoute("/post")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    kind: isJobKind(typeof s.kind === "string" ? s.kind : "") ? (s.kind as JobKind) : undefined,
    from: Number.isInteger(Number(s.from)) && Number(s.from) > 0 ? Number(s.from) : undefined,
  }),
  head: () => seoHead("Postez un anunț", "Publică lucru rapid sau angajare oficială pe Rabotaem.md.", { path: "/post" }),
  component: PostJob,
});

const FREE_ACCESS: MonetizationAccess = {
  mode: "free",
  isPro: false,
  isAdmin: false,
  proUntil: null,
  jobsUsed: 0,
  appliesUsed: 0,
  canPost: true,
  canApply: true,
  freeJobLimit: 999,
  freeApplyLimit: 999,
  monthlyPriceMdl: 0,
  updatedAt: null,
  updatedBy: "",
};

function PostJob() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const { kind: kindFromUrl, from: repostFrom } = Route.useSearch();
  const [repostTitle, setRepostTitle] = useState<string | null>(null);
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
  const [duties, setDuties] = useState("");
  const [adultsChoice, setAdultsChoice] = useState<boolean | null>(null);
  const [requirements, setRequirements] = useState("");
  const [offer, setOffer] = useState("");
  const [expNeeded, setExpNeeded] = useState<(typeof JOB_EXPERIENCE)[number] | "">("");
  const [eduNeeded, setEduNeeded] = useState<(typeof JOB_EDUCATION)[number] | "">("");
  const [langsNeeded, setLangsNeeded] = useState<Array<(typeof CV_LANGS)[number]>>([]);
  const [salaryMax, setSalaryMax] = useState("");
  const [address, setAddress] = useState("");
  const [hrName, setHrName] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [gate, setGate] = useState<{ complete: boolean; verified: boolean; phone: string } | null>(null);
  const [access, setAccess] = useState<MonetizationAccess>(FREE_ACCESS);

  const localities = useMemo(() => localitiesFor(raion), [raion]);
  const [myCompany, setMyCompany] = useState<{ slug: string; name: string } | null | undefined>(undefined);

  useEffect(() => {
    if (!user || kind !== "oficial" || myCompany !== undefined) return;
    getMyCompany()
      .then((c) => {
        setMyCompany(c ? { slug: c.slug, name: c.name } : null);
        if (c) setCompany((prev) => prev || c.name);
      })
      .catch(() => setMyCompany(null));
  }, [user, kind, myCompany]);
  // "Repostează": fill the form from one of the user's old listings.
  useEffect(() => {
    if (!user || !repostFrom) return;
    let cancelled = false;
    getJob({ data: repostFrom })
      .then((job) => {
        if (cancelled || !job) return;
        if (job.user_id !== user.id) {
          toast.error(t("repost.notYours"));
          return;
        }
        const k: JobKind = job.kind === "oficial" ? "oficial" : "rapid";
        setKind(k);
        setTitle(job.title);
        setDescription(job.description);
        setRaion(job.raion);
        setLocality(job.locality);
        setRepostTitle(job.title);
        if (k === "oficial") {
          const d = normalizeJobDetails(job.details);
          if (OFFICIAL_CATEGORIES.some((c) => c.id === job.category)) setOficialCat(job.category as typeof oficialCat);
          setCompany(job.company ?? "");
          if ((CONTRACT_TYPES as readonly string[]).includes(job.contract_type ?? "")) setContract(job.contract_type as typeof contract);
          if ((SCHEDULES as readonly string[]).includes(job.schedule ?? "")) setSchedule(job.schedule as typeof schedule);
          setNegotiable(job.payment_mdl <= 0);
          setSalary(job.payment_mdl > 0 ? String(job.payment_mdl) : "8000");
          setSalaryMax(d.salary_max > 0 ? String(d.salary_max) : "");
          setOpenings(String(Math.max(1, job.people_needed)));
          setDuties(d.responsibilities);
          setRequirements(d.requirements);
          setOffer(d.offer);
          setExpNeeded(d.experience as typeof expNeeded);
          setEduNeeded(d.education as typeof eduNeeded);
          setLangsNeeded(d.languages as typeof langsNeeded);
          setAddress(d.address);
          setHrName(d.hr_name);
        } else {
          if (isCategoryId(job.category)) setCategory(job.category);
          setPayment(String(job.payment_mdl));
          const mins = job.duration_minutes || 60;
          if (mins % 60 === 0) {
            setDuration(String(mins / 60));
            setUnit("hours");
          } else {
            setDuration(String(mins));
            setUnit("minutes");
          }
          const n = Math.max(1, job.people_needed);
          setPeople(n >= 6 ? "6+" : String(n));
          if (n >= 6) setPeopleCustom(String(n));
          setAdultsChoice(job.adults_only ?? null);
          if (job.starts_at) setWorkTime(formatJobTime(job.starts_at));
        }
        getJobExactLocation({ data: { jobId: job.id } })
          .then((loc) => {
            if (!cancelled && loc.visible && loc.lat != null && loc.lng != null) setPin({ lat: loc.lat, lng: loc.lng });
          })
          .catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, repostFrom, t]);

  function applyTemplate(tpl: JobTemplate) {
    setTitle(t(`tpl.${tpl.id}.t`));
    setDescription(t(`tpl.${tpl.id}.d`));
    setCategory(tpl.category);
    setDuration(String(tpl.hours));
    setUnit("hours");
    setPeople(String(tpl.people));
    setAdultsChoice(null);
    toast.success(t("tpl.applied"));
  }

  const adultsOnly = adultsChoice ?? (HEAVY_CATEGORIES as readonly string[]).includes(category);

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
        if (!cancelled) setGate({ complete: true, verified: true, phone: "" });
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
          /* keep free default */
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

  if (gate && !gate.complete) return <Navigate to="/complete" search={{ next: "/post" }} />;
  if (gate && !gate.verified) return <Navigate to="/verify" search={{ next: "/post" }} />;

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
            details: {
              responsibilities: duties.trim(),
              requirements: requirements.trim(),
              offer: offer.trim(),
              experience: expNeeded,
              education: eduNeeded,
              languages: langsNeeded,
              salary_max: negotiable ? 0 : Math.max(0, Number(salaryMax) || 0),
              address: address.trim(),
              hr_name: hrName.trim(),
            },
          },
        });
        toast.success(t("toast.posted"));
        track("job_post", { id: res.id });
        await navigate({ to: "/jobs/$id", params: { id: String(res.id) }, search: { nou: 1 } });
        return;
      }
      const payment_mdl = Number(payment);
      const dur = Number(duration);
      const people_needed = people === "6+" ? Math.max(6, Number(peopleCustom) || 6) : Number(people);
      const duration_minutes = unit === "hours" ? Math.round(dur * 60) : Math.round(dur);
      if (!workDate || !workTime) {
        setBusy(false);
        setError(t("post.dateRequired"));
        return;
      }
      const startsIso = combineDateTime(workDate, workTime);
      if (new Date(startsIso).getTime() <= Date.now()) {
        setBusy(false);
        setError(t("post.dateFuture"));
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
          adults_only: adultsOnly,
        },
      });
      toast.success(t("toast.posted"));
      track("job_post", { id: res.id });
      await navigate({ to: "/jobs/$id", params: { id: String(res.id) }, search: { nou: 1 } });
    } catch (err) {
      const message = errorText(err, t, t("post.publishFail"));
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
              {showPro && access.mode === "paid"
                ? t("pro.paidMode")
                : showPro && access.mode === "freemium"
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
        {showPro && !access.canPost ? (
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
            {repostTitle ? (
              <p className="mt-4 rounded-2xl bg-brand/10 px-4 py-3 text-sm leading-relaxed text-navy ring-1 ring-brand/20" data-testid="repost-banner">
                {t("repost.banner", { t: repostTitle })}
              </p>
            ) : null}
            {kind === "rapid" && !repostTitle ? (
              <section className="mt-4 rounded-[28px] p-4 glass sm:p-5" data-testid="templates">
                <p className="text-sm font-semibold text-navy">{t("tpl.pick")}</p>
                <p className="mt-0.5 text-xs text-muted">{t("tpl.hint")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {JOB_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      data-tpl={tpl.id}
                      onClick={() => applyTemplate(tpl)}
                      className="h-10 rounded-full bg-white/60 px-3.5 text-sm font-medium text-navy ring-1 ring-navy/10 hover:bg-white dark:bg-white/10"
                    >
                      {t(`tpl.${tpl.id}.l`)}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4 rounded-[32px] p-5 glass sm:p-7">
              <div className="rounded-2xl bg-orange/10 px-4 py-3 text-sm leading-relaxed text-navy ring-1 ring-orange/20">
                {t("post.ageWarning")}
              </div>
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
                  {myCompany === null ? (
                    <Link to="/firma" className="-mt-2 block text-sm font-semibold text-[#1d6fd8]" data-testid="post-make-company">
                      {t("company.postHint")}
                    </Link>
                  ) : null}
                  <Field label={t("post.title")} required>
                    <input
                      className="field"
                      required
                      minLength={3}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("post.phOficialTitle")}
                    />
                  </Field>
                  <Field label={t("jd.shortAbout")} required>
                    <textarea
                      className="field min-h-24 py-3"
                      required
                      minLength={20}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("post.oficialDescHint")}
                    />
                    <MinHint value={description} min={20} />
                  </Field>
                  <p className="rounded-2xl bg-navy/5 px-4 py-3 text-sm text-navy">{t("jd.linesHint")}</p>
                  <Field label={t("jd.responsibilities")}>
                    <textarea className="field min-h-28 py-3" maxLength={2000} value={duties} onChange={(e) => setDuties(e.target.value)} placeholder={t("jd.phResponsibilities")} data-testid="jd-duties" />
                  </Field>
                  <Field label={t("jd.requirements")}>
                    <textarea className="field min-h-28 py-3" maxLength={2000} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder={t("jd.phRequirements")} data-testid="jd-requirements" />
                  </Field>
                  <Field label={t("jd.offer")}>
                    <textarea className="field min-h-28 py-3" maxLength={2000} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={t("jd.phOffer")} data-testid="jd-offer" />
                  </Field>
                  <Field label={t("jd.experience")}>
                    <div className="flex flex-wrap gap-2">
                      {JOB_EXPERIENCE.map((x) => (
                        <PickBtn key={x} active={expNeeded === x} onClick={() => setExpNeeded(expNeeded === x ? "" : x)}>
                          {t(`jd.exp.${x}`)}
                        </PickBtn>
                      ))}
                    </div>
                  </Field>
                  <Field label={t("jd.education")}>
                    <div className="flex flex-wrap gap-2">
                      {JOB_EDUCATION.map((x) => (
                        <PickBtn key={x} active={eduNeeded === x} onClick={() => setEduNeeded(eduNeeded === x ? "" : x)}>
                          {t(`jd.edu.${x}`)}
                        </PickBtn>
                      ))}
                    </div>
                  </Field>
                  <Field label={t("jd.languages")}>
                    <div className="flex flex-wrap gap-2">
                      {CV_LANGS.slice(0, 6).map((x) => (
                        <PickBtn
                          key={x}
                          active={langsNeeded.includes(x)}
                          onClick={() => setLangsNeeded(langsNeeded.includes(x) ? langsNeeded.filter((l) => l !== x) : [...langsNeeded, x])}
                        >
                          {t(`cv.lang.${x}`)}
                        </PickBtn>
                      ))}
                    </div>
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
                      minLength={3}
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
                      placeholder={t("post.phRapidDesc")}
                    />
                    <MinHint value={description} min={20} />
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("kind.contract")}>
                    <select className="field" value={contract} onChange={(e) => setContract(e.target.value as typeof contract)}>
                      {CONTRACT_TYPES.map((c) => (
                        <option key={c} value={c}>{t(`contract.${c}`)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("kind.schedule")}>
                    <select className="field" value={schedule} onChange={(e) => setSchedule(e.target.value as typeof schedule)}>
                      {SCHEDULES.map((s) => (
                        <option key={s} value={s}>{t(`schedule.${s}`)}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}
              {kind === "rapid" ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("post.payment")} required>
                    <input className="field" type="number" min={1} required value={payment} onChange={(e) => setPayment(e.target.value)} />
                  </Field>
                  <Field label={t("post.duration")} required>
                    <div className="flex gap-2">
                      <input className="field" type="number" min={1} required value={duration} onChange={(e) => setDuration(e.target.value)} />
                      <select className="field w-24" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
                        <option value="hours">{t("post.hours")}</option>
                        <option value="minutes">{t("post.minutes")}</option>
                      </select>
                    </div>
                  </Field>
                  <Field label={t("post.people")}>
                    <select className="field" value={people} onChange={(e) => setPeople(e.target.value)}>
                      {["1","2","3","4","5","6+"].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {people === "6+" ? (
                      <input className="field mt-2" type="number" min={6} value={peopleCustom} onChange={(e) => setPeopleCustom(e.target.value)} />
                    ) : null}
                  </Field>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("kind.salary")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input className="field w-28 flex-1" type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} disabled={negotiable} aria-label={t("jd.salaryFrom")} />
                      <span className="text-sm text-muted">–</span>
                      <input className="field w-28 flex-1" type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} disabled={negotiable} placeholder={t("jd.salaryTo")} aria-label={t("jd.salaryTo")} data-testid="jd-salary-max" />
                      <label className="flex items-center gap-1 text-sm">
                        <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
                        {t("kind.salaryNegotiable")}
                      </label>
                    </div>
                  </Field>
                  <Field label={t("kind.openings")}>
                    <input className="field" type="number" min={1} value={openings} onChange={(e) => setOpenings(e.target.value)} />
                  </Field>
                  <Field label={t("jd.address")}>
                    <input className="field" maxLength={160} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("jd.phAddress")} />
                  </Field>
                  <Field label={t("jd.hr")}>
                    <input className="field" maxLength={80} value={hrName} onChange={(e) => setHrName(e.target.value)} placeholder={t("jd.phHr")} />
                  </Field>
                </div>
              )}
              {kind === "rapid" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("post.date")} required>
                    <input className="field" type="date" required min={toMinDate()} value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
                  </Field>
                  <Field label={t("post.time")} required>
                    <input className="field" type="time" required value={workTime} onChange={(e) => setWorkTime(e.target.value)} />
                  </Field>
                </div>
              ) : null}
              {kind === "rapid" ? (
                <label className="flex items-start gap-3 rounded-2xl bg-navy/5 p-4 text-sm text-navy">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0"
                    checked={adultsOnly}
                    onChange={(e) => setAdultsChoice(e.target.checked)}
                    data-testid="post-adults-only"
                  />
                  <span>
                    <span className="block text-base font-semibold">{t("age.heavyLabel")}</span>
                    {t("age.heavyHint")}
                  </span>
                </label>
              ) : null}
              {phone ? <PhoneLocked phone={phone} /> : null}
              <CaptchaField onChange={setCaptcha} />
              {showPro && access ? <UsageHint access={access} action="post" /> : null}
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

function PickBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white"
          : "h-11 rounded-full bg-white/50 px-4 text-sm font-medium text-navy ring-1 ring-navy/8 dark:bg-white/10"
      }
    >
      {children}
    </button>
  );
}

/** "At least N characters (you have X)" under a field, so nobody is stuck guessing. */
function MinHint({ value, min }: { value: string; min: number }) {
  const { t } = useT();
  const n = value.trim().length;
  if (n >= min) return null;
  return (
    <span className="mt-1 block text-sm text-muted" data-testid="min-hint">
      {t("post.minChars", { min, n })}
    </span>
  );
}
