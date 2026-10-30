import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { sendResetCode, setPasswordWithSms, verifyResetCode, formatPhoneDisplay, formatSmsError } from "@/lib/phone";
import { seoHead } from "@/lib/seo";
import { Shell } from "@/components/shell";
import { Logo } from "@/components/logo";
import { useT } from "@/lib/locale";

export const Route = createFileRoute("/reset")({
  head: () => seoHead("Parolă uitată", "Resetează parola contului Rabotaem.md prin SMS."),
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useT();
  const [step, setStep] = useState<"phone" | "code" | "password" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const tmr = window.setTimeout(() => setWait((v) => v - 1), 1000);
    return () => window.clearTimeout(tmr);
  }, [wait]);

  function fail(err: unknown, fallback: string) {
    const raw = err instanceof Error ? err.message : fallback;
    setError(formatSmsError(raw, t, fallback));
    const cooldown = raw.match(/sms\.errCooldown\|(\d+)/);
    if (cooldown) setWait(Number(cooldown[1]));
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await sendResetCode({ data: { phone: phone.trim() } });
      setPreview(res.previewCode ?? null);
      setWait(60);
      setStep("code");
    } catch (err) {
      fail(err, "sms.send");
    } finally {
      setBusy(false);
    }
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await verifyResetCode({ data: { phone: phone.trim(), code } });
      setTicket(res.ticket);
      setStep("password");
    } catch (err) {
      fail(err, "sms.verify");
    } finally {
      setBusy(false);
    }
  }

  async function onPassword(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("reset.mismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setPasswordWithSms({ data: { phone: phone.trim(), ticket, password } });
      setStep("done");
    } catch (err) {
      fail(err, "reset.submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto flex max-w-lg flex-col px-4 py-12 pb-24 sm:px-6">
        <div className="rounded-[32px] p-6 glass-strong sm:p-8" data-testid="reset-screen">
          <Logo size="lg" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-navy">{t("reset.title")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {step === "done" ? t("reset.ok") : t("reset.blurb")}
          </p>

          {step === "phone" ? (
            <form onSubmit={(e) => void send(e)} className="mt-6 space-y-3">
              <input
                className="field"
                required
                minLength={8}
                inputMode="tel"
                autoComplete="tel"
                data-testid="reset-phone"
                placeholder={t("reset.phone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                disabled={busy || wait > 0 || phone.replace(/\D/g, "").length < 8}
                data-testid="reset-send"
                className="sheen flex h-12 w-full items-center justify-center rounded-full glass-orange text-sm font-semibold disabled:opacity-45"
              >
                {busy ? t("login.busy") : wait > 0 ? t("sms.wait", { n: wait }) : t("reset.send")}
              </button>
            </form>
          ) : null}

          {step === "code" ? (
            <form onSubmit={(e) => void onCode(e)} className="mt-6 space-y-3">
              <p className="text-sm font-medium text-navy">
                {t("sms.sent", { p: formatPhoneDisplay(phone) })}
              </p>
              {preview ? (
                <p
                  className="rounded-xl bg-navy/6 px-3 py-2 font-mono text-sm tracking-[0.3em] text-navy"
                  data-testid="sms-preview"
                >
                  {t("sms.preview", { c: preview })}
                </p>
              ) : null}
              <input
                className="field tracking-[0.35em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                minLength={6}
                placeholder={t("sms.code")}
                data-testid="reset-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="sheen flex h-12 w-full items-center justify-center rounded-full glass-orange text-sm font-semibold disabled:opacity-45"
              >
                {t("reset.next")}
              </button>
              <button
                type="button"
                disabled={busy || wait > 0}
                onClick={() => void send()}
                className="w-full text-center text-sm font-medium text-muted hover:text-navy disabled:opacity-45"
              >
                {wait > 0 ? t("sms.wait", { n: wait }) : t("sms.resend")}
              </button>
            </form>
          ) : null}

          {step === "password" ? (
            <form onSubmit={(e) => void onPassword(e)} className="mt-6 space-y-3">
              <input
                className="field"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder={t("reset.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                className="field"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder={t("reset.confirm")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                disabled={busy || password.length < 8}
                className="sheen flex h-12 w-full items-center justify-center rounded-full glass-orange text-sm font-semibold disabled:opacity-45"
              >
                {busy ? t("login.busy") : t("reset.submit")}
              </button>
            </form>
          ) : null}

          {step === "done" ? (
            <Link
              to="/login"
              className="sheen mt-6 flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold glass-orange"
            >
              {t("login.submitIn")}
            </Link>
          ) : null}
        </div>
        <Link to="/login" className="mt-6 text-center text-sm text-muted hover:text-navy">
          {t("login.haveAccount")}
        </Link>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-subtle">{t("sms.limits")}</p>
      </main>
    </Shell>
  );
}
