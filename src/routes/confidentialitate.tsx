import { createFileRoute } from "@tanstack/react-router";
import { LegalBlock, LegalPage } from "@/components/legal-page";
import { seoHead } from "@/lib/seo";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/confidentialitate")({
  head: () => seoHead("Politica de confidențialitate", "Cum Rabotaem.md prelucrează datele personale."),
  component: PrivacyPage,
});

export const PRIVACY_UPDATED = "10.11.2026";
const SECTIONS = ["operator", "data", "why", "who", "providers", "keep", "rights", "minors", "security", "changes"] as const;

/** Renders "• item" lines as a list and other lines as paragraphs. */
function Rich({ text }: { text: string }) {
  const blocks: Array<{ type: "p"; text: string } | { type: "ul"; items: string[] }> = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (line.startsWith("• ")) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "ul") last.items.push(line.slice(2));
      else blocks.push({ type: "ul", items: [line.slice(2)] });
    } else blocks.push({ type: "p", text: line });
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{b.text}</p>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

function PrivacyPage() {
  const { t } = useT();
  return (
    <LegalPage title={t("legal.privacyTitle")} lead={t("priv.lead", { d: PRIVACY_UPDATED })}>
      {SECTIONS.map((s, i) => (
        <LegalBlock key={s} title={`${i + 1}. ${t(`priv.${s}.t`)}`}>
          <Rich text={t(`priv.${s}.b`)} />
        </LegalBlock>
      ))}
    </LegalPage>
  );
}
