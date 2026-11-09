import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, FileText, Pencil, Send, Upload } from "lucide-react";
import { getMyCv, listMyCvFiles, type CvFileMeta, type MyCv } from "@/lib/cv";
import { cvIsUsable } from "@/lib/cv-shared";
import { applyToJob } from "@/lib/jobs";
import { CvFileRow, CvUploadButton } from "@/components/cv-files";
import { PhoneLocked } from "@/components/phone-verify";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { cn, formatJobDate } from "@/lib/utils";

type Choice = "site" | "file" | "make";

/** "Angajare" application: pick a CV (site / file / make one), contacts, cover note, consent. */
export function OfficialApply({
  jobId,
  jobTitle,
  company,
  firstName,
  lastName,
  phone,
  onApplied,
}: {
  jobId: number;
  jobTitle: string;
  company: string;
  firstName: string;
  lastName: string;
  phone: string;
  onApplied: () => void;
}) {
  const { t } = useT();
  const [cv, setCv] = useState<MyCv | undefined>(undefined);
  const [files, setFiles] = useState<CvFileMeta[]>([]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [fileId, setFileId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyCv(), listMyCvFiles()])
      .then(([c, f]) => {
        if (cancelled) return;
        setCv(c);
        setFiles(f);
        if (c?.data.email) setEmail(c.data.email);
        const usable = c && cvIsUsable(c.data);
        if (usable) setChoice("site");
        else if (f[0]) {
          setChoice("file");
          setFileId(f[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setCv(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const siteOk = Boolean(cv && cvIsUsable(cv.data));
  const next = `/jobs/${jobId}#aplica`;

  async function submit() {
    setError(null);
    if (choice !== "site" && !(choice === "file" && fileId)) {
      setError(t("cv.errNoCv"));
      return;
    }
    if (!consent) {
      setError(t("cv.errConsent"));
      return;
    }
    setBusy(true);
    try {
      await applyToJob({
        data: {
          jobId,
          message: message.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          cv_kind: choice === "site" ? "site" : "file",
          cv_file_id: choice === "file" ? fileId : null,
          email: email.trim(),
          consent,
        },
      });
      onApplied();
    } catch (err) {
      setError(errorText(err, t, t("job.applyFail")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-6" data-testid="official-apply">
      <Step n={1} title={t("oa.step1")}>
        {cv === undefined ? (
          <div className="h-32 animate-pulse rounded-2xl bg-navy/5" />
        ) : (
          <div className="space-y-2.5">
            {siteOk ? (
              <Option
                active={choice === "site"}
                onClick={() => setChoice("site")}
                icon={<FileText className="size-6" />}
                title={t("oa.siteCv")}
                sub={`${cv!.data.title} · ${t("cv.updated", { d: formatJobDate(cv!.updated_at) })}`}
                testId="oa-site"
                extra={
                  <Link to="/cv" target="_blank" className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-[#1d6fd8] hover:bg-[#1d6fd8]/8">
                    <Eye className="size-4" />
                    {t("oa.view")}
                  </Link>
                }
              />
            ) : null}
            <Option
              active={choice === "file"}
              onClick={() => {
                setChoice("file");
                if (!fileId && files[0]) setFileId(files[0].id);
              }}
              icon={<Upload className="size-6" />}
              title={t("oa.fileCv")}
              sub={t("oa.fileCvSub")}
              testId="oa-file"
            />
            {choice === "file" ? (
              <div className="space-y-2 pl-1">
                {files.map((f) => (
                  <CvFileRow key={f.id} file={f} selected={fileId === f.id} onSelect={() => setFileId(f.id)} />
                ))}
                <CvUploadButton
                  label={files.length ? t("oa.uploadOther") : undefined}
                  onUploaded={(f) => {
                    setFiles((list) => [f, ...list]);
                    setFileId(f.id);
                  }}
                />
              </div>
            ) : null}
            <Link
              to="/cv/edit"
              search={{ next }}
              data-testid="oa-make"
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-navy/12 hover:bg-white/80 dark:hover:bg-white/10",
                !siteOk && "ring-2 ring-orange/60",
              )}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-orange/15 text-orange-deep">
                <Pencil className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-navy">{siteOk ? t("oa.editCv") : t("oa.makeCv")}</span>
                <span className="block text-sm text-muted">{t("oa.makeCvSub")}</span>
              </span>
            </Link>
          </div>
        )}
      </Step>

      <Step n={2} title={t("oa.step2")}>
        <p className="text-base font-semibold text-navy">
          {firstName} {lastName}
        </p>
        {phone ? <div className="mt-2"><PhoneLocked phone={phone} /></div> : null}
        <label className="mt-3 block">
          <span className="text-sm font-medium text-navy">
            {t("oa.email")} <span className="font-normal text-muted">({t("cv.optional")})</span>
          </span>
          <input
            type="email"
            className="field mt-1 text-base"
            value={email}
            maxLength={120}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nume@mail.md"
            data-testid="oa-email"
          />
        </label>
      </Step>

      <Step n={3} title={t("oa.step3")}>
        <textarea
          className="field min-h-28 py-3 text-base"
          value={message}
          maxLength={800}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("oa.letterPh")}
          data-testid="oa-letter"
        />
        <button
          type="button"
          onClick={() => setMessage(t("oa.letterExample", { job: jobTitle, company: company || t("oa.yourCompany") }))}
          className="mt-2 h-11 rounded-full px-4 text-sm font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5"
        >
          {t("cv.useExample")}
        </button>
      </Step>

      <label className="flex items-start gap-3 rounded-2xl bg-navy/5 p-4 text-base text-navy">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          data-testid="oa-consent"
        />
        <span>
          {t("oa.consent", { company: company || t("oa.theEmployer") })}{" "}
          <Link to="/confidentialitate" target="_blank" className="font-semibold text-[#1d6fd8] underline">
            {t("oa.privacy")}
          </Link>
        </span>
      </label>

      {error ? (
        <p className="rounded-2xl bg-danger/10 px-4 py-3 text-base font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        data-testid="oa-submit"
        className="sheen flex h-16 w-full items-center justify-center gap-2 rounded-full text-lg font-bold glass-orange shadow-[var(--shadow-orange)] disabled:opacity-60"
      >
        <Send className="size-5" />
        {busy ? t("apply.sending") : t("oa.send")}
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2.5 text-lg font-semibold text-navy">
        <span className="grid size-8 place-items-center rounded-full bg-brand text-sm font-bold text-white">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Option({
  active,
  onClick,
  icon,
  title,
  sub,
  extra,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  sub: string;
  extra?: ReactNode;
  testId: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl p-3 ring-1 transition-colors",
        active ? "bg-[#1d6fd8]/8 ring-2 ring-[#1d6fd8]" : "ring-navy/12 hover:bg-white/80 dark:hover:bg-white/10",
      )}
    >
      <button type="button" onClick={onClick} aria-pressed={active} data-testid={testId} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl",
            active ? "bg-[#1d6fd8] text-white" : "bg-navy/8 text-navy",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-navy">{title}</span>
          <span className="block truncate text-sm text-muted">{sub}</span>
        </span>
      </button>
      {extra}
    </div>
  );
}
