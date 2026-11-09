import { Briefcase, Car, GraduationCap, Languages, Mail, MapPin, Phone, Sparkles, UserRound } from "lucide-react";
import {
  ageFromBirthYear,
  lastJob,
  topEducation,
  totalExperienceYears,
  type CvData,
} from "@/lib/cv-shared";
import { formatPhoneDisplay } from "@/lib/phone";
import { useT } from "@/lib/locale";
import { cn } from "@/lib/utils";

export function formatYm(ym: string) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return m ? `${m}.${y}` : y;
}

export function yearsLabel(t: (k: string, v?: Record<string, string | number>) => string, years: number) {
  if (years <= 0) return t("cv.noExpShort");
  if (years < 1) return t("cv.lessThanYear");
  return t(years === 1 ? "cv.oneYear" : "cv.years", { n: String(years).replace(".", ",") });
}

/** The CV as a clean one-page document (also what gets printed / saved as PDF). */
export function CvDocument({
  cv,
  photo,
  name,
  phone,
  email,
  className,
}: {
  cv: CvData;
  photo: string | null;
  name: string;
  phone?: string | null;
  email?: string;
  className?: string;
}) {
  const { t } = useT();
  const age = ageFromBirthYear(cv.birthYear);
  const mail = email || cv.email;
  return (
    <article className={cn("cv-doc rounded-[28px] bg-white p-6 text-[#0b2548] shadow-sm ring-1 ring-black/5 sm:p-10", className)} data-testid="cv-doc">
      <header className="flex flex-col items-center gap-4 border-b border-black/10 pb-6 text-center sm:flex-row sm:items-center sm:text-left">
        {photo ? (
          <img src={photo} alt="" className="size-24 shrink-0 rounded-full object-cover ring-4 ring-[#0b2548]/8" />
        ) : (
          <span className="grid size-24 shrink-0 place-items-center rounded-full bg-[#0b2548]/8">
            <UserRound className="size-10 text-[#0b2548]/50" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          {cv.title ? <p className="mt-1 text-lg font-semibold text-[#f15a22]">{cv.title}</p> : null}
          <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-[#0b2548]/75 sm:justify-start">
            {cv.city ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" />
                {cv.city}
              </span>
            ) : null}
            {age ? <span>{t("cv.ageYears", { n: age })}</span> : null}
            {phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-4" />
                {formatPhoneDisplay(phone)}
              </span>
            ) : null}
            {mail ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-4" />
                {mail}
              </span>
            ) : null}
          </p>
        </div>
      </header>

      {cv.about ? (
        <section className="mt-6">
          <h2 className="cv-h">{t("cv.secAbout")}</h2>
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{cv.about}</p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="cv-h">
          <Briefcase className="size-5" />
          {t("cv.secExperience")}
          <span className="ml-auto text-sm font-medium text-[#0b2548]/60">{yearsLabel(t, totalExperienceYears(cv))}</span>
        </h2>
        {cv.noExperience || cv.experience.length === 0 ? (
          <p className="mt-2 text-base text-[#0b2548]/75">{t("cv.noExpText")}</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {cv.experience.map((e, i) => (
              <li key={i} className="border-l-2 border-[#f15a22]/50 pl-4">
                <p className="text-base font-semibold">
                  {e.role || "—"}
                  {e.company ? <span className="font-normal text-[#0b2548]/75"> · {e.company}</span> : null}
                </p>
                <p className="text-sm text-[#0b2548]/60">
                  {formatYm(e.from)} – {e.current || !e.to ? t("cv.present") : formatYm(e.to)}
                </p>
                {e.description ? <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{e.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {cv.education.length > 0 ? (
        <section className="mt-6">
          <h2 className="cv-h">
            <GraduationCap className="size-5" />
            {t("cv.secEducation")}
          </h2>
          <ul className="mt-3 space-y-3">
            {cv.education.map((e, i) => (
              <li key={i}>
                <p className="text-base font-semibold">{e.school || (e.level ? t(`cv.edu.${e.level}`) : "—")}</p>
                <p className="text-sm text-[#0b2548]/70">
                  {[e.school && e.level ? t(`cv.edu.${e.level}`) : "", e.field, [e.from, e.to].filter(Boolean).join(" – ")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {cv.languages.length > 0 ? (
          <section>
            <h2 className="cv-h">
              <Languages className="size-5" />
              {t("cv.secLanguages")}
            </h2>
            <ul className="mt-2 space-y-1 text-base">
              {cv.languages.map((l) => (
                <li key={l.lang} className="flex justify-between gap-3">
                  <span>{t(`cv.lang.${l.lang}`)}</span>
                  <span className="text-[#0b2548]/65">{t(`cv.level.${l.level}`)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {cv.skills.length > 0 || cv.driving.length > 0 ? (
          <section>
            <h2 className="cv-h">
              <Sparkles className="size-5" />
              {t("cv.secSkills")}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cv.skills.map((s) => (
                <span key={s} className="rounded-full bg-[#0b2548]/7 px-3 py-1 text-sm">
                  {s}
                </span>
              ))}
            </div>
            {cv.driving.length > 0 ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
                <Car className="size-4" />
                {t("cv.drivingCats", { c: cv.driving.join(", ") })}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
      <p className="mt-8 text-center text-xs text-[#0b2548]/40">Rabotaem.md</p>
    </article>
  );
}

/** One-glance summary of a CV for the employer's candidate list. */
export function CvSummary({ cv, compact = false }: { cv: CvData; compact?: boolean }) {
  const { t } = useT();
  const job = lastJob(cv);
  const edu = topEducation(cv);
  const age = ageFromBirthYear(cv.birthYear);
  const rows: Array<{ icon: typeof Briefcase; text: string }> = [];
  rows.push({
    icon: Briefcase,
    text: [yearsLabel(t, totalExperienceYears(cv)), job ? t("cv.lastJob", { role: job.role || "—", company: job.company || "—" }) : ""]
      .filter(Boolean)
      .join(" · "),
  });
  if (edu) {
    const text = [edu.level ? t(`cv.edu.${edu.level}`) : "", edu.school, edu.field].filter(Boolean).join(", ");
    if (text) rows.push({ icon: GraduationCap, text });
  }
  if (cv.languages.length)
    rows.push({
      icon: Languages,
      text: cv.languages.map((l) => `${l.lang.toUpperCase()} ${t(`cv.level.${l.level}`).toLowerCase()}`).join(" · "),
    });
  const place = [cv.city, age ? t("cv.ageYears", { n: age }) : "", cv.driving.length ? t("cv.drivingCats", { c: cv.driving.join(", ") }) : ""]
    .filter(Boolean)
    .join(" · ");
  if (place) rows.push({ icon: MapPin, text: place });
  return (
    <div data-testid="cv-summary">
      {cv.title ? <p className="text-base font-semibold text-orange-deep">{cv.title}</p> : null}
      <ul className={cn("mt-1.5 space-y-1.5 text-navy", compact ? "text-sm" : "text-base")}>
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <r.icon className="mt-0.5 size-4 shrink-0 text-muted" />
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
