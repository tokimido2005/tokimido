import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/disclaimer")({
  head: () => seoHead("Disclaimer", "Rabotaem.md este o platformă de anunțuri, nu o agenție de recrutare."),
  component: DisclaimerPage,
});

function DisclaimerPage() {
  return (
    <LegalPage
      title="Disclaimer"
      lead="Citește cu atenție înainte să folosești Rabotaem.md. Prin utilizarea site-ului, accepți cele de mai jos."
    >
      <section className="space-y-3">
        <p>
          Rabotaem.md este o platformă de anunțuri. Nu suntem agenție de recrutare, nu intermediăm contracte de muncă și
          nu răspundem pentru: plata sau neplata lucrului, calitatea sau finalizarea lucrului, conflictele dintre
          utilizatori, veridicitatea anunțurilor.
        </p>
        <p>Utilizatorii se contactează și se înțeleg direct. Platforma nu garantează rezultate.</p>
        <p>
          Prin utilizarea site-ului, acceptați că Rabotaem.md nu este parte a înțelegerii dintre cei care postează
          anunțuri și cei care aplică.
        </p>
      </section>
      <p>
        Detaliile de folosire sunt în{" "}
        <Link to="/termeni" className="font-medium text-orange-deep underline">
          Termeni și condiții
        </Link>
        .
      </p>
    </LegalPage>
  );
}
