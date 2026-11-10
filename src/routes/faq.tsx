import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { seoHead } from "@/lib/seo";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/faq")({
  head: () => seoHead("Întrebări frecvente", "Răspunsuri despre Rabotaem.md, plăți, anunțuri și cont.", { path: "/faq" }),
  component: FaqPage,
});

function FaqPage() {
  const { t } = useT();
  const items = [
    ["faq.q1", "faq.a1"],
    ["faq.q2", "faq.a2"],
    ["faq.q3", "faq.a3"],
    ["faq.q4", "faq.a4"],
    ["faq.q5", "faq.a5"],
    ["faq.q6", "faq.a6"],
    ["faq.q7", "faq.a7"],
  ] as const;
  return (
    <LegalPage title={t("faq.title")} lead={t("faq.lead")}>
      {items.map(([q, a]) => (
        <section key={q}>
          <h2 className="text-base font-semibold text-navy">{t(q)}</h2>
          <p className="mt-2 text-muted">{t(a)}</p>
        </section>
      ))}
    </LegalPage>
  );
}
