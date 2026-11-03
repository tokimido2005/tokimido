import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalBlock, LegalPage } from "@/components/legal-page";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/termeni")({
  head: () => seoHead("Termeni și condiții", "Regulile de folosire a platformei Rabotaem.md."),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Termeni și condiții"
      lead="Prin crearea unui cont sau prin folosirea Rabotaem.md, accepți acești termeni. Sunt scriși simplu, în română."
    >
      <LegalBlock title="1. Ce este Rabotaem.md">
        <p>
          Rabotaem.md este o platformă de anunțuri. Aici poți publica un anunț sau aplica la unul. Nu suntem agenție de
          recrutare, nu angajăm oameni și nu intermediăm contracte de muncă.
        </p>
      </LegalBlock>
      <LegalBlock title="2. Înregistrare">
        <p>
          Contul se creează cu date reale: nume, email și telefon. Numărul de telefon se verifică prin SMS. Un număr
          este legat de un singur cont. Ești responsabil pentru păstrarea parolei și pentru activitatea din cont.
        </p>
      </LegalBlock>
      <LegalBlock title="2.1. Vârstă minimă și minori">
        <p>
          Pentru a crea un cont pe Rabotaem.md trebuie să ai cel puțin 16 ani. Prin bifarea checkbox-ului de la
          înregistrare, confirmi că îndeplinești această condiție.
        </p>
        <p>
          Este strict interzisă publicarea de anunțuri care solicită persoane sub 15 ani. Anunțurile de acest tip vor
          fi șterse imediat, iar contul poate fi blocat.
        </p>
        <p>
          Pentru persoanele între 15 și 18 ani, cel care postează anunțul (angajatorul) este pe deplin responsabil să
          dețină acordul părinților sau al reprezentantului legal și să respecte toate limitele legale privind
          munca minorilor (durată, tip de activitate, condiții de siguranță). Rabotaem.md nu verifică aceste
          documente și nu își asumă nicio răspundere în acest sens.
        </p>
        <p>
          Platforma își rezervă dreptul de a șterge orice anunț sau de a bloca orice cont care încalcă aceste reguli,
          fără preaviz.
        </p>
      </LegalBlock>
      <LegalBlock title="3. Reguli pentru postarea anunțurilor">
        <p>
          Anunțurile trebuie să fie reale. Este interzis să publici anunțuri false, înșelătoare, ilegale sau care cer
          bani în avans fără o înțelegere clară între părți. Poți șterge sau închide propriul anunț oricând.
        </p>
      </LegalBlock>
      <LegalBlock title="4. Aplicare la un anunț">
        <p>
          Când aplici, trimiți datele tale celui care a postat anunțul. Datele de contact sunt vizibile doar după
          aplicare, nu public, în lista de anunțuri. După aplicare, vă contactați și vă înțelegeți direct.
        </p>
      </LegalBlock>
      <LegalBlock title="5. Responsabilitate">
        <p>
          Platforma nu răspunde de plată sau neplată, de calitatea sau finalizarea lucrului și de conflictele dintre
          utilizatori. Rabotaem.md nu este parte a înțelegerii dintre cel care postează și cel care aplică. Nu
          garantăm că vei găsi de lucru sau că vei găsi pe cineva pentru anunțul tău.
        </p>
        <p>
          Citește și{" "}
          <Link to="/disclaimer" className="font-medium text-navy underline">
            Disclaimer
          </Link>
          .
        </p>
      </LegalBlock>
      <LegalBlock title="6. Date personale">
        <p>
          Colectăm doar ce este necesar ca să funcționeze contul, anunțurile, aplicațiile și verificarea telefonului.
          Nu vindem datele tale. Poți cere ștergerea contului și a datelor asociate, din cont sau scriindu-ne la
          contact.
        </p>
      </LegalBlock>
      <LegalBlock title="7. Blocarea conturilor">
        <p>
          Putem suspenda sau bloca conturile care încalcă acești termeni, publică anunțuri false ori ilegale, hărțuiesc
          alți utilizatori sau folosesc platforma în mod abuziv.
        </p>
      </LegalBlock>
      <LegalBlock title="8. Modificarea termenilor">
        <p>
          Putem actualiza acești termeni. Versiunea afișată pe această pagină este cea valabilă. Dacă continui să
          folosești site-ul după o modificare, înseamnă că accepți termenii noi.
        </p>
      </LegalBlock>
    </LegalPage>
  );
}
