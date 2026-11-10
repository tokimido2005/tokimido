import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalBlock, LegalPage } from "@/components/legal-page";
import { seoHead } from "@/lib/seo";

export const Route = createFileRoute("/termeni")({
  head: () => seoHead("Termeni și condiții", "Regulile de folosire a platformei Rabotaem.md.", { path: "/termeni" }),
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
          Pentru a crea un cont pe Rabotaem.md trebuie să ai cel puțin 16 ani. La completarea profilului îți indici anul
          nașterii; acesta nu se afișează public și este folosit doar pentru regulile de mai jos.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Lucru rapid:</b> de la 16 ani. Anunțurile marcate „Muncă fizică grea (doar 18+)” sunt doar pentru persoane
            de la 18 ani.
          </li>
          <li>
            <b>Angajare oficială:</b> doar de la 18 ani.
          </li>
        </ul>
        <p>
          Codul muncii al Republicii Moldova interzice folosirea persoanelor sub 18 ani la munci grele, vătămătoare sau
          periculoase și prevede pentru ele un timp de muncă redus. Cel care publică anunțul (angajatorul) răspunde
          integral de respectarea acestor reguli: tipul muncii, durata, pauzele, condițiile de siguranță și, unde legea o
          cere, acordul părinților sau al reprezentantului legal. Anunțurile cu muncă fizică grea trebuie marcate „doar
          18+”.
        </p>
        <p>
          Este strict interzisă publicarea de anunțuri pentru persoane sub 16 ani. Platforma poate șterge orice anunț și
          bloca orice cont care încalcă aceste reguli, fără preaviz. Rabotaem.md nu verifică documentele părților și nu
          este parte la înțelegerile dintre ele.
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
          Colectăm doar ce este necesar ca să funcționeze contul, anunțurile, aplicațiile, CV-urile și verificarea
          telefonului. Nu vindem datele tale. Detaliile sunt în{" "}
          <Link to="/confidentialitate" className="font-medium text-navy underline">
            Politica de confidențialitate
          </Link>
          .
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
