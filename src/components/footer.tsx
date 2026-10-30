import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { useT } from "@/lib/locale";
import { useMoneyMode } from "@/lib/money-mode";
import { CATEGORIES } from "@/lib/categories";
import { RAION_NAMES } from "@/lib/moldova";

export function Footer() {
  const { t } = useT();
  const { showPro } = useMoneyMode();
  return (
    <footer className="mt-20 px-4 pb-[max(2.5rem,calc(2.5rem+env(safe-area-inset-bottom)))] sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[32px] p-6 glass sm:p-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <Logo size="lg" />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {showPro ? t("footer.blurbPaid") : t("footer.blurb")}
            </p>
          </div>
          <div className="flex flex-wrap gap-10 text-sm">
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-navy">{t("footer.platform")}</span>
              <Link to="/" hash="joburi" className="text-muted hover:text-navy">
                {t("nav.jobs")}
              </Link>
              <Link to="/angajare" className="text-muted hover:text-navy">
                {t("nav.angajare")}
              </Link>
              <Link to="/post" className="text-muted hover:text-navy">
                {t("nav.post")}
              </Link>
              {showPro ? (
                <Link to="/pro" data-testid="footer-pro" className="text-muted hover:text-navy">
                  {t("pro.nav")}
                </Link>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-navy">{t("footer.account")}</span>
              <Link to="/aplicatii" className="text-muted hover:text-navy">
                {t("nav.apps")}
              </Link>
              <Link to="/cont" className="text-muted hover:text-navy">
                {t("nav.account")}
              </Link>
              <Link to="/cont" search={{ tab: "saved" }} className="text-muted hover:text-navy">
                {t("nav.saved")}
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-navy">{t("footer.legalTitle")}</span>
              <Link to="/termeni" className="text-muted hover:text-navy">
                {t("footer.terms")}
              </Link>
              <Link to="/disclaimer" className="text-muted hover:text-navy">
                {t("footer.disclaimer")}
              </Link>
              <Link to="/confidentialitate" className="text-muted hover:text-navy">
                {t("footer.privacy")}
              </Link>
              <Link to="/faq" className="text-muted hover:text-navy">
                {t("footer.faq")}
              </Link>
              <Link to="/contact" className="text-muted hover:text-navy">
                {t("footer.contact")}
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-navy">{t("footer.seoCats")}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.id}
                  to="/c/$category"
                  params={{ category: c.id }}
                  className="text-muted hover:text-navy"
                >
                  {t(`cat.${c.id}`)}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-navy">{t("footer.seoPlaces")}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {RAION_NAMES.slice(0, 16).map((r) => (
                <Link key={r} to="/r/$raion" params={{ raion: r }} className="text-muted hover:text-navy">
                  {r}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-8 rounded-2xl bg-navy/6 p-4 text-sm leading-relaxed text-navy/80">
          {t("footer.legal")}
        </div>
        <p className="mt-5 text-xs text-subtle">© {new Date().getFullYear()} Rabotaem.md</p>
      </div>
    </footer>
  );
}
