import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { FilePlus2, Pencil, Printer } from "lucide-react";
import { Shell } from "@/components/shell";
import { CvDocument } from "@/components/cv-document";
import { CvFileRow, CvUploadButton } from "@/components/cv-files";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyCv, listMyCvFiles, type CvFileMeta, type MyCv } from "@/lib/cv";
import { getMyProfile, type Profile } from "@/lib/profile";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";
import { formatJobDate } from "@/lib/utils";

export const Route = createFileRoute("/cv/")({
  head: () => seoHead("CV-ul meu", "CV-ul tău pe Rabotaem.md: îl trimiți la angajări cu un singur clic.", { noindex: true }),
  component: MyCvPage,
});

function MyCvPage() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const [cv, setCv] = useState<MyCv | undefined>(undefined);
  const [files, setFiles] = useState<CvFileMeta[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const reload = useCallback(() => {
    return Promise.all([getMyCv(), listMyCvFiles(), getMyProfile().catch(() => null)]).then(([c, f, p]) => {
      setCv(c);
      setFiles(f);
      setProfile(p);
    });
  }, []);

  useEffect(() => {
    if (user) void reload().catch(() => setCv(null));
  }, [user, reload]);

  if (isPending) return <Shell><main className="mx-auto max-w-3xl px-4 py-16"><div className="h-64 animate-pulse rounded-[32px] bg-white/40" /></main></Shell>;
  if (!user) return <Navigate to="/login" search={{ next: "/cv" }} />;

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user.displayName || "—";

  return (
    <Shell>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("cv.myTitle")}</h1>
        <p className="mt-2 text-base text-muted">{t("cv.myLead")}</p>

        {cv === undefined ? (
          <div className="mt-6 h-64 animate-pulse rounded-[28px] bg-white/40" />
        ) : cv === null ? (
          <section className="mt-6 rounded-[28px] p-6 text-center glass sm:p-8" data-testid="cv-empty">
            <FilePlus2 className="mx-auto size-12 text-orange" />
            <h2 className="mt-3 text-xl font-semibold text-navy">{t("cv.emptyTitle")}</h2>
            <p className="mt-2 text-base text-muted">{t("cv.emptyBody")}</p>
            <Link
              to="/cv/edit"
              className="mt-5 inline-flex h-14 items-center gap-2 rounded-full bg-orange px-6 text-base font-bold text-white"
              data-testid="cv-start"
            >
              <Pencil className="size-5" />
              {t("cv.makeNow")}
            </Link>
          </section>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link
                to="/cv/edit"
                className="flex h-14 items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white"
                data-testid="cv-edit"
              >
                <Pencil className="size-5" />
                {t("cv.edit")}
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex h-14 items-center justify-center gap-2 rounded-full text-base font-semibold text-navy ring-2 ring-navy/20 hover:bg-navy/5"
              >
                <Printer className="size-5" />
                {t("cv.pdf")}
              </button>
            </div>
            <p className="mt-2 text-center text-sm text-muted">
              {t("cv.updated", { d: formatJobDate(cv.updated_at) })} · {t("cv.pdfHint")}
            </p>
            <div className="mt-5">
              <CvDocument cv={cv.data} photo={cv.photo} name={name} phone={profile?.phone} />
            </div>
          </>
        )}

        <section className="mt-8 rounded-[28px] p-5 glass sm:p-6">
          <h2 className="text-xl font-semibold text-navy">{t("cv.filesTitle")}</h2>
          <p className="mt-1 text-base text-muted">{t("cv.filesLead")}</p>
          <div className="mt-4 space-y-2">
            {files.map((f) => (
              <CvFileRow key={f.id} file={f} onDeleted={() => void reload()} />
            ))}
          </div>
          <div className="mt-4">
            <CvUploadButton onUploaded={() => void reload()} />
          </div>
        </section>
      </main>
    </Shell>
  );
}
