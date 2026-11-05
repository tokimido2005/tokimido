import { errorText } from "@/lib/i18n";
import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { submitSupport } from "@/lib/safety";
import { seoHead } from "@/lib/seo";
import { track } from "@/lib/analytics";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/contact")({
  head: () => seoHead("Contact / Support", "Scrie echipei Rabotaem.md pentru întrebări sau probleme."),
  component: ContactPage,
});

function ContactPage() {
  const { t } = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitSupport({ data: { name, email, message } });
      track("support_message");
      toast.success(t("contact.sent"));
      setMessage("");
    } catch (err) {
      toast.error(errorText(err, t, t("contact.error")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-navy">{t("contact.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t("contact.lead")}</p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3 rounded-[32px] p-5 glass sm:p-7">
          <input
            className="field"
            required
            minLength={2}
            placeholder={t("contact.name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="field"
            type="email"
            required
            placeholder={t("contact.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <textarea
            className="field min-h-32 py-3"
            required
            minLength={10}
            placeholder={t("contact.message")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="sheen flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold glass-orange disabled:opacity-50"
          >
            {busy ? t("contact.sending") : t("contact.send")}
          </button>
        </form>
      </main>
    </Shell>
  );
}
