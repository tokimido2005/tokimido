import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowLeft, Download, Mail, Phone, Printer } from "lucide-react";
import { Shell } from "@/components/shell";
import { CvDocument } from "@/components/cv-document";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getApplicationCv, type ApplicationCv } from "@/lib/cv";
import { cvFileUrl, downloadCvFile, formatSize } from "@/lib/cv-client";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { formatPhoneDisplay } from "@/lib/phone";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/cv/a/$id")({
  head: () => seoHead("CV candidat", "CV trimis pe Rabotaem.md.", { noindex: true }),
  component: ApplicationCvPage,
});

function ApplicationCvPage() {
  const { t } = useT();
  const { id } = Route.useParams();
  const { user, isPending } = useCurrentUserState();
  const [data, setData] = useState<ApplicationCv | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let url: string | null = null;
    getApplicationCv({ data: { applicationId: Number(id) } })
      .then(async (r) => {
        if (cancelled) return;
        setData(r);
        if (r.file && (r.file.mime === "application/pdf" || r.file.mime.startsWith("image/"))) {
          const f = await cvFileUrl(r.file.id);
          url = f.url;
          if (!cancelled) setFileUrl(f.url);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, t, t("cv.errNotFound")));
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [user, id, t]);

  if (isPending) return <Shell><main className="mx-auto max-w-3xl px-4 py-16"><div className="h-64 animate-pulse rounded-[32px] bg-white/40" /></main></Shell>;
  if (!user) return <Navigate to="/login" search={{ next: `/cv/a/${id}` }} />;

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/aplicatii"
          search={{ tab: data?.isEmployer === false ? "trimise" : "primite" }}
          className="inline-flex h-11 items-center gap-1.5 text-base font-medium text-muted hover:text-navy"
        >
          <ArrowLeft className="size-5" />
          {t("cv.backToApps")}
        </Link>

        {error ? (
          <p className="mt-6 rounded-[24px] p-6 text-center text-base text-muted glass">{error}</p>
        ) : !data ? (
          <div className="mt-6 h-64 animate-pulse rounded-[28px] bg-white/40" />
        ) : (
          <>
            <section className="mt-3 rounded-[24px] p-5 glass" data-testid="cv-app-head">
              <p className="text-sm text-muted">
                {t("cv.sentFor")} <b className="text-navy">{data.jobTitle}</b>
                {data.company ? ` · ${data.company}` : ""}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {data.phone && data.isEmployer ? (
                  <a href={`tel:${data.phone}`} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1d6fd8] text-base font-bold text-white">
                    <Phone className="size-5" />
                    {formatPhoneDisplay(data.phone)}
                  </a>
                ) : null}
                {data.email && data.isEmployer ? (
                  <a href={`mailto:${data.email}`} className="flex h-12 items-center justify-center gap-2 rounded-full text-base font-semibold text-navy ring-2 ring-navy/20">
                    <Mail className="size-5" />
                    {t("cv.writeEmail")}
                  </a>
                ) : null}
                {data.cv ? (
                  <button type="button" onClick={() => window.print()} className="flex h-12 items-center justify-center gap-2 rounded-full text-base font-semibold text-navy ring-2 ring-navy/20">
                    <Printer className="size-5" />
                    {t("cv.pdf")}
                  </button>
                ) : null}
              </div>
              {data.message ? (
                <div className="mt-4 rounded-2xl bg-navy/5 p-4">
                  <p className="text-xs font-semibold text-muted">{t("cv.coverLetter")}</p>
                  <p className="mt-1 whitespace-pre-wrap text-base text-navy">{data.message}</p>
                </div>
              ) : null}
            </section>

            {data.cv ? (
              <div className="mt-5">
                <CvDocument cv={data.cv} photo={data.photo} name={data.name} phone={data.isEmployer ? data.phone : null} email={data.email} />
              </div>
            ) : data.file ? (
              <section className="mt-5 rounded-[24px] p-5 glass" data-testid="cv-app-file">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-base font-semibold text-navy">
                    {data.file.name} <span className="font-normal text-muted">· {formatSize(data.file.size)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void downloadCvFile(data.file!.id)}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-5 text-base font-bold text-white"
                    data-testid="cv-app-download"
                  >
                    <Download className="size-5" />
                    {t("cv.download")}
                  </button>
                </div>
                {fileUrl && data.file.mime.startsWith("image/") ? (
                  <img src={fileUrl} alt={data.file.name} className="mt-4 w-full rounded-2xl bg-white" />
                ) : fileUrl ? (
                  <iframe src={fileUrl} title={data.file.name} className="mt-4 h-[80vh] w-full rounded-2xl bg-white" />
                ) : (
                  <p className="mt-3 text-base text-muted">{t("cv.wordHint")}</p>
                )}
              </section>
            ) : (
              <p className="mt-5 rounded-[24px] p-6 text-center text-base text-muted glass">{t("cv.noCvSent")}</p>
            )}
          </>
        )}
      </main>
    </Shell>
  );
}
