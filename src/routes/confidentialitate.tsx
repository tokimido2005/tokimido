import { createFileRoute } from "@tanstack/react-router";
import { LegalBlock, LegalPage } from "@/components/legal-page";
import { seoHead } from "@/lib/seo";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/confidentialitate")({
  head: () => seoHead("Politica de confidențialitate", "Cum Rabotaem.md prelucrează datele personale."),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useT();
  return (
    <LegalPage title={t("legal.privacyTitle")} lead={t("legal.privacyLead")}>
      <LegalBlock title={t("legal.p1t")}>
        <p>{t("legal.p1")}</p>
      </LegalBlock>
      <LegalBlock title={t("legal.p2t")}>
        <p>{t("legal.p2")}</p>
      </LegalBlock>
      <LegalBlock title={t("legal.p3t")}>
        <p>{t("legal.p3")}</p>
      </LegalBlock>
      <LegalBlock title={t("legal.p4t")}>
        <p>{t("legal.p4")}</p>
      </LegalBlock>
    </LegalPage>
  );
}
