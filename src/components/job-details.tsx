import { CheckCircle2, ClipboardList, Gift, GraduationCap, Languages, MapPin, Timer, UserRound } from "lucide-react";
import { bulletLines, normalizeJobDetails, type JobDetails } from "@/lib/cv-shared";
import { useT } from "@/lib/locale";

function hasAny(d: JobDetails) {
  return Boolean(
    d.responsibilities || d.requirements || d.offer || d.experience || d.education || d.languages.length || d.address || d.hr_name,
  );
}

/** Structured "angajare" listing: what you'll do, what's needed, what's offered. */
export function JobDetailsBlock({ details: raw }: { details: JobDetails | undefined }) {
  const { t } = useT();
  // Older listings store "{}" (or partial objects): normalize before reading.
  const details = normalizeJobDetails(raw);
  if (!hasAny(details)) return null;
  const facts: Array<{ icon: typeof Timer; label: string; value: string }> = [];
  if (details.experience) facts.push({ icon: Timer, label: t("jd.experience"), value: t(`jd.exp.${details.experience}`) });
  if (details.education) facts.push({ icon: GraduationCap, label: t("jd.education"), value: t(`jd.edu.${details.education}`) });
  if (details.languages.length)
    facts.push({ icon: Languages, label: t("jd.languages"), value: details.languages.map((l) => t(`cv.lang.${l}`)).join(", ") });
  if (details.address) facts.push({ icon: MapPin, label: t("jd.address"), value: details.address });
  if (details.hr_name) facts.push({ icon: UserRound, label: t("jd.hr"), value: details.hr_name });

  return (
    <div className="mt-6 space-y-6" data-testid="job-details">
      {facts.length ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.label} className="flex items-start gap-3 rounded-2xl bg-navy/5 px-4 py-3">
              <f.icon className="mt-0.5 size-5 shrink-0 text-muted" />
              <div>
                <dt className="text-xs font-medium text-muted">{f.label}</dt>
                <dd className="text-base font-semibold text-navy">{f.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}
      <Section icon={ClipboardList} title={t("jd.responsibilities")} text={details.responsibilities} />
      <Section icon={CheckCircle2} title={t("jd.requirements")} text={details.requirements} />
      <Section icon={Gift} title={t("jd.offer")} text={details.offer} />
    </div>
  );
}

function Section({ icon: Icon, title, text }: { icon: typeof Gift; title: string; text: string }) {
  const lines = bulletLines(text);
  if (lines.length === 0) return null;
  return (
    <section>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
        <Icon className="size-5 text-orange" />
        {title}
      </h2>
      <ul className="mt-2 space-y-1.5">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2.5 text-base leading-relaxed text-navy/85">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-orange" />
            {l}
          </li>
        ))}
      </ul>
    </section>
  );
}
