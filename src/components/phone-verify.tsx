import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { sendPhoneCode, verifyPhoneCode, formatPhoneDisplay, formatSmsError } from "@/lib/phone";
import { useT } from "@/lib/locale";

export function PhoneLocked({ phone }: { phone: string }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-navy/6 px-4 py-3 dark:bg-white/8" data-testid="phone-locked">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-orange/15 text-orange-deep">
        <Lock className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">{t("phone.locked")}</p>
        <p className="mt-0.5 font-semibold tabular-nums text-navy">{formatPhoneDisplay(phone)}</p>
      </div>
    </div>
  );
}

export function PhoneVerifyPanel({
  phone,
  purpose = "verify",
  onVerified,
  autoSend = true,
}: {
  phone: string;
  purpose?: "verify" | "change";
  onVerified: () => void;
  autoSend?: boolean;
}) {
  const { t } = useT();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const auto = useRef(false);

  useEffect(() => {
    if (!autoSend || auto.current) return;
    if (phone.replace(/\D/g, "").length < 8) return;
    auto.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, autoSend]);

  useEffect(() => {
    if (wait <= 0) return;
    const tmr = window.setTimeout(() => setWait((v) => v - 1), 1000);
    return () => window.clearTimeout(tmr);
  }, [wait]);

  async function send(fromUser = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await sendPhoneCode({ data: { phone, purpose } });
      setSent(true);
      setWait(60);
      setPreview(res.previewCode ?? null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "sms.send";
      const cooldown = raw.match(/sms\.errCooldown\|(\d+)/);
      if (cooldown) {
        setWait(Number(cooldown[1]));
        setSent(true);
        if (fromUser) setError(formatSmsError(raw, t));
      } else {
        setError(formatSmsError(raw, t));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneCode({ data: { phone, purpose, code } });
      onVerified();
    } catch (err) {
      setError(formatSmsError(err instanceof Error ? err.message : "sms.verify", t, "sms.verify"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[24px] bg-white/45 p-4 ring-1 ring-navy/8 dark:bg-white/8">
      <h2 className="text-sm font-semibold text-navy">{t("sms.title")}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">{t("sms.blurb")}</p>
      <div className="mt-3">
        <PhoneLocked phone={phone} />
      </div>
      {sent ? (
        <p className="mt-2 text-xs font-medium text-navy">{t("sms.sent", { p: formatPhoneDisplay(phone) })}</p>
      ) : null}
      {preview ? (
        <p
          className="mt-2 rounded-xl bg-navy/6 px-3 py-2 font-mono text-sm tracking-[0.3em] text-navy"
          data-testid="sms-preview"
        >
          {t("sms.preview", { c: preview })}
        </p>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-3 space-y-2">
        <input
          className="field tracking-[0.35em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          minLength={6}
          placeholder={t("sms.code")}
          data-testid="sms-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || code.length < 6}
          className="sheen flex h-12 w-full items-center justify-center rounded-full glass-orange text-sm font-semibold disabled:opacity-45"
        >
          {t("sms.verify")}
        </button>
      </form>
      <button
        type="button"
        disabled={busy || wait > 0}
        onClick={() => void send(true)}
        className="mt-2 w-full text-center text-sm font-medium text-muted hover:text-navy disabled:opacity-45"
      >
        {wait > 0 ? t("sms.wait", { n: wait }) : sent ? t("sms.resend") : t("sms.send")}
      </button>
      <p className="mt-3 text-[11px] leading-relaxed text-subtle">{t("sms.limits")}</p>
    </div>
  );
}
