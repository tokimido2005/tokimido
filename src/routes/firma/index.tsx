import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { Building2, Camera, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { COMPANY_SIZES, getMyCompany, saveMyCompany, type Company } from "@/lib/companies";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { seoHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/firma/")({
  head: () => ({ ...seoHead("Pagina firmei", "Pagina firmei tale pe Rabotaem.md."), meta: [{ name: "robots", content: "noindex" }] }),
  component: MyCompanyPage,
});

/** Square-ish logo, max 256 px, small JPEG/PNG data URL. */
async function compressLogo(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 256;
  const scale = Math.min(max / bitmap.width, max / bitmap.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = canvas.toDataURL("image/png");
  if (png.length < 170_000) return png;
  const jpg = canvas.toDataURL("image/jpeg", 0.85);
  if (jpg.length > 180_000) throw new Error("too-big");
  return jpg;
}

function MyCompanyPage() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [existing, setExisting] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [size, setSize] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMyCompany()
      .then((c) => {
        setExisting(c);
        if (c) {
          setName(c.name);
          setLogo(c.logo);
          setDescription(c.description);
          setCity(c.city);
          setWebsite(c.website);
          setSize(c.size);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [user]);

  if (isPending) return <Shell><main className="mx-auto max-w-2xl px-4 py-16"><div className="h-64 animate-pulse rounded-[32px] bg-white/40" /></main></Shell>;
  if (!user) return <Navigate to="/login" search={{ next: "/firma" }} />;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await saveMyCompany({
        data: { name, logo, description, city, website, size: size as (typeof COMPANY_SIZES)[number] | "" },
      });
      toast.success(t("company.saved"));
      await navigate({ to: "/firma/$slug", params: { slug: res.slug } });
    } catch (err) {
      setError(errorText(err, t, t("error.update")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">{t(existing ? "company.editTitle" : "company.createTitle")}</h1>
        <p className="mt-2 text-base text-muted">{t("company.lead")}</p>
        {existing ? (
          <Link
            to="/firma/$slug"
            params={{ slug: existing.slug }}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-full px-4 text-base font-semibold text-[#1d6fd8] ring-1 ring-[#1d6fd8]/30"
          >
            <ExternalLink className="size-4" />
            {t("company.viewPublic")}
          </Link>
        ) : null}

        {!loaded ? (
          <div className="mt-6 h-64 animate-pulse rounded-[28px] bg-white/40" />
        ) : (
          <form
            className="mt-6 space-y-5 rounded-[28px] p-5 glass sm:p-7"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="flex items-center gap-4">
              {logo ? (
                <img src={logo} alt="" className="size-20 rounded-2xl bg-white object-contain p-1 ring-1 ring-navy/10" />
              ) : (
                <span className="grid size-20 place-items-center rounded-2xl bg-navy/8 text-navy">
                  <Building2 className="size-8" />
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold text-navy ring-1 ring-navy/20 hover:bg-navy/5">
                  <Camera className="size-4" />
                  {logo ? t("company.logoChange") : t("company.logoAdd")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    data-testid="company-logo"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      compressLogo(f)
                        .then(setLogo)
                        .catch(() => toast.error(t("company.errLogo")));
                    }}
                  />
                </label>
                {logo ? (
                  <button type="button" onClick={() => setLogo(null)} className="h-11 rounded-full px-3 text-sm text-muted hover:text-danger">
                    {t("cv.photoRemove")}
                  </button>
                ) : null}
              </div>
            </div>
            <Field label={t("company.name")} required>
              <input className="field text-base" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Market Plus SRL" data-testid="company-name" />
            </Field>
            {existing?.verified ? <p className="-mt-3 text-sm text-muted">{t("company.renameWarn")}</p> : null}
            <Field label={t("company.description")} hint={t("company.descriptionHint")}>
              <textarea className="field min-h-32 py-3 text-base" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("company.descriptionPh")} data-testid="company-description" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("company.city")}>
                <input className="field text-base" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Chișinău" />
              </Field>
              <Field label={t("company.website")}>
                <input className="field text-base" maxLength={160} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.firma.md" />
              </Field>
            </div>
            <div>
              <p className="text-base font-semibold text-navy">{t("company.size")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COMPANY_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(size === s ? "" : s)}
                    aria-pressed={size === s}
                    className={cn(
                      "min-h-11 rounded-full px-4 text-base font-medium",
                      size === s ? "bg-brand text-white" : "bg-white/60 text-navy ring-1 ring-navy/12 dark:bg-white/10",
                    )}
                  >
                    {t("company.employees", { n: s })}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="rounded-2xl bg-danger/10 px-4 py-3 text-base font-medium text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || name.trim().length < 2}
              data-testid="company-save"
              className="flex h-14 w-full items-center justify-center rounded-full bg-brand text-lg font-bold text-white disabled:opacity-60"
            >
              {busy ? t("cv.saving") : t("company.save")}
            </button>
          </form>
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
