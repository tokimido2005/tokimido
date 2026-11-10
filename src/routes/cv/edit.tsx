import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Check, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { CvDocument } from "@/components/cv-document";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyCv, saveMyCv } from "@/lib/cv";
import {
  CV_DRIVING,
  CV_EDU_LEVELS,
  CV_LANGS,
  CV_LEVELS,
  CV_SKILL_SUGGESTIONS,
  emptyCv,
  normalizeCv,
  type CvData,
  type CvEducation,
  type CvExperience,
} from "@/lib/cv-shared";
import { getMyProfile } from "@/lib/profile";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";
import { cn, compressPhotoFile } from "@/lib/utils";

const DRAFT_KEY = "rabotaem-cv-draft";

export const Route = createFileRoute("/cv/edit")({
  head: () => seoHead("Fă-ți CV-ul", "Creează un CV în câțiva pași simpli pe Rabotaem.md.", { noindex: true }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  component: CvEditPage,
});

const STEPS = ["about", "experience", "education", "languages", "skills", "summary"] as const;
type Step = (typeof STEPS)[number];

function CvEditPage() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [cv, setCv] = useState<CvData | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("about");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([getMyCv(), getMyProfile().catch(() => null)])
      .then(([mine, profile]) => {
        if (cancelled) return;
        let data = mine?.data ?? null;
        if (!data) {
          try {
            const draft = localStorage.getItem(DRAFT_KEY);
            if (draft) data = normalizeCv(JSON.parse(draft));
          } catch {
            /* ignore */
          }
        }
        setCv(data ?? emptyCv());
        setPhoto(mine?.photo ?? profile?.photo_data ?? null);
        setName([profile?.first_name, profile?.last_name].filter(Boolean).join(" "));
        setPhone(profile?.phone ?? "");
      })
      .catch(() => {
        if (!cancelled) setCv(emptyCv());
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Keep a local draft so nothing is lost if the page closes mid-way.
  useEffect(() => {
    if (!cv) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(cv));
    } catch {
      /* ignore */
    }
  }, [cv]);

  if (isPending) return <Shell><main className="mx-auto max-w-2xl px-4 py-16"><div className="h-64 animate-pulse rounded-[32px] bg-white/40" /></main></Shell>;
  if (!user) return <Navigate to="/login" search={{ next: "/cv/edit" }} />;

  const index = STEPS.indexOf(step);
  const set = (patch: Partial<CvData>) => setCv((c) => (c ? { ...c, ...patch } : c));

  function validate(s: Step): string | null {
    if (!cv) return null;
    if (s === "about" && cv.title.trim().length < 2) return t("cv.errTitle");
    if (s === "experience" && !cv.noExperience && !cv.experience.some((e) => e.role.trim() || e.company.trim())) {
      return t("cv.errExperience");
    }
    return null;
  }

  function goNext() {
    const err = validate(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!cv) return;
    for (const s of STEPS) {
      const err = validate(s);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await saveMyCv({ data: { data: cv, photo } });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      toast.success(t("cv.saved"));
      if (next) window.location.assign(next);
      else await navigate({ to: "/cv" });
    } catch (err) {
      setError(errorText(err, t, t("cv.saveFail")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("cv.builderTitle")}</h1>
        <p className="mt-2 text-base text-muted">{t("cv.builderLead")}</p>

        <ol className="mt-5 grid grid-cols-6 gap-1.5" aria-label={t("cv.builderTitle")}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => i < index && setStep(s)}
                aria-current={s === step ? "step" : undefined}
                className={cn("h-2.5 w-full rounded-full", i <= index ? "bg-orange" : "bg-navy/12")}
                aria-label={t(`cv.step.${s}`)}
              />
            </li>
          ))}
        </ol>
        <p className="mt-2 text-sm font-semibold text-navy" data-testid="cv-step">
          {t("cv.stepOf", { n: index + 1, total: STEPS.length })} · {t(`cv.step.${step}`)}
        </p>

        {!cv ? (
          <div className="mt-6 h-64 animate-pulse rounded-[28px] bg-white/40" />
        ) : (
          <div className="mt-5 rounded-[28px] p-5 glass sm:p-7">
            {step === "about" ? <AboutStep cv={cv} set={set} photo={photo} setPhoto={setPhoto} name={name} /> : null}
            {step === "experience" ? <ExperienceStep cv={cv} set={set} /> : null}
            {step === "education" ? <EducationStep cv={cv} set={set} /> : null}
            {step === "languages" ? <LanguagesStep cv={cv} set={set} /> : null}
            {step === "skills" ? <SkillsStep cv={cv} set={set} /> : null}
            {step === "summary" ? (
              <div className="space-y-5">
                <Field label={t("cv.about")} hint={t("cv.aboutHint")}>
                  <textarea
                    className="field min-h-36 py-3 text-base"
                    value={cv.about}
                    maxLength={1200}
                    onChange={(e) => set({ about: e.target.value })}
                    placeholder={t("cv.aboutPh")}
                    data-testid="cv-about"
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => set({ about: t("cv.aboutExample", { title: cv.title || "…" }) })}
                  className="h-11 rounded-full px-4 text-sm font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5"
                >
                  {t("cv.useExample")}
                </button>
                <p className="text-sm font-semibold text-navy">{t("cv.preview")}</p>
                <div className="-mx-2 sm:mx-0">
                  <CvDocument cv={cv} photo={photo} name={name || "—"} phone={phone} />
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-base font-medium text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(STEPS[index - 1]);
                  }}
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-base font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5"
                >
                  <ArrowLeft className="size-5" />
                  {t("cv.back")}
                </button>
              ) : null}
              {step !== "summary" ? (
                <button
                  type="button"
                  onClick={goNext}
                  data-testid="cv-next"
                  className="flex h-14 flex-[2] items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white"
                >
                  {t("cv.next")}
                  <ArrowRight className="size-5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  data-testid="cv-save"
                  className="flex h-14 flex-[2] items-center justify-center gap-2 rounded-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Check className="size-5" />
                  {saving ? t("cv.saving") : next ? t("cv.saveAndApply") : t("cv.save")}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}

function Field({ label, hint, children, required }: { label: string; hint?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-base font-semibold text-navy">
        {label}
        {required ? <span className="text-orange"> *</span> : null}
      </span>
      {hint ? <span className="mt-0.5 block text-sm text-muted">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Choice({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        "min-h-11 rounded-full px-4 text-base font-medium transition-colors",
        active ? "bg-brand text-white" : "bg-white/60 text-navy ring-1 ring-navy/12 hover:bg-white dark:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function AboutStep({
  cv,
  set,
  photo,
  setPhoto,
  name,
}: {
  cv: CvData;
  set: (p: Partial<CvData>) => void;
  photo: string | null;
  setPhoto: (p: string | null) => void;
  name: string;
}) {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {photo ? (
          <img src={photo} alt="" className="size-20 rounded-full object-cover" />
        ) : (
          <span className="grid size-20 place-items-center rounded-full bg-navy/8 text-navy">
            <Camera className="size-7" />
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5">
            <Camera className="size-4" />
            {photo ? t("cv.photoChange") : t("cv.photoAdd")}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                compressPhotoFile(f)
                  .then(setPhoto)
                  .catch(() => toast.error(t("cv.photoFail")));
              }}
            />
          </label>
          {photo ? (
            <button type="button" onClick={() => setPhoto(null)} className="h-11 rounded-full px-3 text-sm text-muted hover:text-danger">
              {t("cv.photoRemove")}
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted">{t("cv.photoHint")}</p>
      <p className="rounded-2xl bg-navy/5 px-4 py-3 text-base text-navy">
        {t("cv.nameFromProfile")}: <b>{name || "—"}</b>
      </p>
      <Field label={t("cv.title")} hint={t("cv.titleHint")} required>
        <input
          className="field text-base"
          value={cv.title}
          maxLength={100}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t("cv.titlePh")}
          data-testid="cv-title"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("cv.city")}>
          <input className="field text-base" value={cv.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} placeholder="Chișinău" data-testid="cv-city" />
        </Field>
        <Field label={t("cv.birthYear")}>
          <input
            className="field text-base tabular-nums"
            inputMode="numeric"
            maxLength={4}
            value={cv.birthYear}
            onChange={(e) => set({ birthYear: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            placeholder="1985"
          />
        </Field>
      </div>
      <Field label={t("cv.email")} hint={t("cv.optional")}>
        <input className="field text-base" type="email" value={cv.email} maxLength={120} onChange={(e) => set({ email: e.target.value })} placeholder="nume@mail.md" />
      </Field>
    </div>
  );
}

function MonthInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy">{label}</span>
      <input type="month" className="field mt-1 text-base tabular-nums" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function ExperienceStep({ cv, set }: { cv: CvData; set: (p: Partial<CvData>) => void }) {
  const { t } = useT();
  const items = cv.experience;
  const update = (i: number, patch: Partial<CvExperience>) =>
    set({ experience: items.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const add = () =>
    set({
      noExperience: false,
      experience: [...items, { company: "", role: "", from: "", to: "", current: items.length === 0, description: "" }],
    });
  useEffect(() => {
    if (items.length === 0 && !cv.noExperience) add();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-navy/5 px-4 text-base text-navy">
        <input
          type="checkbox"
          className="size-5"
          checked={cv.noExperience}
          onChange={(e) => set({ noExperience: e.target.checked, experience: e.target.checked ? [] : items })}
          data-testid="cv-no-exp"
        />
        {t("cv.noExperience")}
      </label>
      {!cv.noExperience
        ? items.map((e, i) => (
            <fieldset key={i} className="space-y-3 rounded-2xl p-4 ring-1 ring-navy/12">
              <div className="flex items-center justify-between">
                <legend className="text-base font-semibold text-navy">{t("cv.jobN", { n: i + 1 })}</legend>
                <button
                  type="button"
                  onClick={() => set({ experience: items.filter((_, j) => j !== i) })}
                  className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-muted hover:text-danger"
                >
                  <Trash2 className="size-4" />
                  {t("cv.remove")}
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("cv.role")}>
                  <input className="field text-base" value={e.role} maxLength={100} onChange={(ev) => update(i, { role: ev.target.value })} placeholder={t("cv.rolePh")} data-testid="cv-role" />
                </Field>
                <Field label={t("cv.company")}>
                  <input className="field text-base" value={e.company} maxLength={100} onChange={(ev) => update(i, { company: ev.target.value })} placeholder={t("cv.companyPh")} data-testid="cv-company" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MonthInput label={t("cv.from")} value={e.from} onChange={(v) => update(i, { from: v })} />
                {e.current ? (
                  <div className="flex items-end">
                    <p className="h-12 w-full rounded-2xl bg-emerald-600/10 px-4 text-base leading-[3rem] font-medium text-emerald-800 dark:text-emerald-200">
                      {t("cv.present")}
                    </p>
                  </div>
                ) : (
                  <MonthInput label={t("cv.to")} value={e.to} onChange={(v) => update(i, { to: v })} />
                )}
              </div>
              <label className="flex items-center gap-3 text-base text-navy">
                <input type="checkbox" className="size-5" checked={e.current} onChange={(ev) => update(i, { current: ev.target.checked, to: "" })} />
                {t("cv.currentJob")}
              </label>
              <Field label={t("cv.duties")} hint={t("cv.optional")}>
                <textarea className="field min-h-24 py-3 text-base" value={e.description} maxLength={800} onChange={(ev) => update(i, { description: ev.target.value })} placeholder={t("cv.dutiesPh")} />
              </Field>
            </fieldset>
          ))
        : null}
      {!cv.noExperience ? (
        <button
          type="button"
          onClick={add}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-navy ring-1 ring-navy/25 hover:bg-navy/5"
        >
          <Plus className="size-5" />
          {t("cv.addJob")}
        </button>
      ) : null}
    </div>
  );
}

function EducationStep({ cv, set }: { cv: CvData; set: (p: Partial<CvData>) => void }) {
  const { t } = useT();
  const items = cv.education;
  const update = (i: number, patch: Partial<CvEducation>) =>
    set({ education: items.map((e, j) => (j === i ? { ...e, ...patch } : e)) });
  const year = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  return (
    <div className="space-y-5">
      <p className="text-base text-muted">{t("cv.educationHint")}</p>
      {items.map((e, i) => (
        <fieldset key={i} className="space-y-3 rounded-2xl p-4 ring-1 ring-navy/12">
          <div className="flex items-center justify-between">
            <legend className="text-base font-semibold text-navy">{t("cv.schoolN", { n: i + 1 })}</legend>
            <button
              type="button"
              onClick={() => set({ education: items.filter((_, j) => j !== i) })}
              className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-muted hover:text-danger"
            >
              <Trash2 className="size-4" />
              {t("cv.remove")}
            </button>
          </div>
          <div>
            <span className="text-sm font-medium text-navy">{t("cv.eduLevel")}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {CV_EDU_LEVELS.map((l) => (
                <Choice key={l} active={e.level === l} onClick={() => update(i, { level: l })}>
                  {t(`cv.edu.${l}`)}
                </Choice>
              ))}
            </div>
          </div>
          <Field label={t("cv.school")}>
            <input className="field text-base" value={e.school} maxLength={140} onChange={(ev) => update(i, { school: ev.target.value })} placeholder={t("cv.schoolPh")} />
          </Field>
          <Field label={t("cv.field")} hint={t("cv.optional")}>
            <input className="field text-base" value={e.field} maxLength={100} onChange={(ev) => update(i, { field: ev.target.value })} placeholder={t("cv.fieldPh")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("cv.fromYear")}>
              <input className="field text-base tabular-nums" inputMode="numeric" value={e.from} onChange={(ev) => update(i, { from: year(ev.target.value) })} placeholder="2005" />
            </Field>
            <Field label={t("cv.toYear")}>
              <input className="field text-base tabular-nums" inputMode="numeric" value={e.to} onChange={(ev) => update(i, { to: year(ev.target.value) })} placeholder="2009" />
            </Field>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() => set({ education: [...items, { school: "", field: "", level: "", from: "", to: "" }] })}
        data-testid="cv-add-school"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-navy ring-1 ring-navy/25 hover:bg-navy/5"
      >
        <Plus className="size-5" />
        {t("cv.addSchool")}
      </button>
    </div>
  );
}

function LanguagesStep({ cv, set }: { cv: CvData; set: (p: Partial<CvData>) => void }) {
  const { t } = useT();
  const levelOf = (lang: string) => cv.languages.find((l) => l.lang === lang)?.level;
  const setLevel = (lang: (typeof CV_LANGS)[number], level: (typeof CV_LEVELS)[number] | null) => {
    const rest = cv.languages.filter((l) => l.lang !== lang);
    set({ languages: level ? [...rest, { lang, level }] : rest });
  };
  const [more, setMore] = useState(false);
  const shown = more ? CV_LANGS : CV_LANGS.filter((l, i) => i < 3 || levelOf(l));
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-base text-muted">{t("cv.languagesHint")}</p>
        {shown.map((lang) => (
          <div key={lang} data-testid={`cv-lang-${lang}`}>
            <p className="text-base font-semibold text-navy">{t(`cv.lang.${lang}`)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CV_LEVELS.map((lv) => (
                <Choice key={lv} active={levelOf(lang) === lv} onClick={() => setLevel(lang, levelOf(lang) === lv ? null : lv)}>
                  {t(`cv.level.${lv}`)}
                </Choice>
              ))}
            </div>
          </div>
        ))}
        {!more ? (
          <button type="button" onClick={() => setMore(true)} className="h-11 rounded-full px-4 text-sm font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5">
            {t("cv.moreLanguages")}
          </button>
        ) : null}
      </div>
      <div>
        <p className="text-base font-semibold text-navy">{t("cv.driving")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CV_DRIVING.map((c) => (
            <Choice
              key={c}
              active={cv.driving.includes(c)}
              onClick={() => set({ driving: cv.driving.includes(c) ? cv.driving.filter((x) => x !== c) : [...cv.driving, c] })}
            >
              {c}
            </Choice>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{t("cv.drivingHint")}</p>
      </div>
    </div>
  );
}

function SkillsStep({ cv, set }: { cv: CvData; set: (p: Partial<CvData>) => void }) {
  const { t } = useT();
  const [custom, setCustom] = useState("");
  const all = useMemo(() => [...new Set([...CV_SKILL_SUGGESTIONS, ...cv.skills])], [cv.skills]);
  const toggle = (s: string) =>
    set({ skills: cv.skills.includes(s) ? cv.skills.filter((x) => x !== s) : [...cv.skills, s].slice(0, 25) });
  function addCustom() {
    const v = custom.trim();
    if (!v) return;
    if (!cv.skills.includes(v)) set({ skills: [...cv.skills, v].slice(0, 25) });
    setCustom("");
  }
  return (
    <div className="space-y-5">
      <p className="text-base text-muted">{t("cv.skillsHint")}</p>
      <div className="flex flex-wrap gap-2">
        {all.map((s) => (
          <Choice key={s} active={cv.skills.includes(s)} onClick={() => toggle(s)}>
            {cv.skills.includes(s) ? <Check className="mr-1 inline size-4" /> : null}
            {s}
          </Choice>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="field text-base"
          value={custom}
          maxLength={40}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={t("cv.skillPh")}
        />
        <button type="button" onClick={addCustom} className="h-12 shrink-0 rounded-full bg-brand px-5 text-base font-semibold text-white">
          {t("cv.add")}
        </button>
      </div>
      {cv.skills.length > 0 ? (
        <p className="text-sm text-muted">
          {t("cv.chosen")}: {cv.skills.join(", ")}{" "}
          <button type="button" onClick={() => set({ skills: [] })} className="inline-flex items-center text-danger">
            <X className="size-4" />
          </button>
        </p>
      ) : null}
    </div>
  );
}
