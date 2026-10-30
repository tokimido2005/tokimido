import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { issueCaptcha } from "@/lib/captcha";
import { useT } from "@/lib/locale";

export type CaptchaValue = { token: string; answer: number };

export function CaptchaField({
  onChange,
}: {
  onChange: (value: CaptchaValue | null) => void;
}) {
  const { t } = useT();
  const [token, setToken] = useState("");
  const [question, setQuestion] = useState("…");
  const [answer, setAnswer] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const genRef = useRef(0);

  const reload = useCallback(() => {
    const gen = ++genRef.current;
    setAnswer("");
    onChangeRef.current(null);
    issueCaptcha()
      .then((row) => {
        if (gen !== genRef.current) return;
        setToken(row.token);
        setQuestion(row.question);
      })
      .catch(() => {
        if (gen !== genRef.current) return;
        setQuestion("—");
      });
  }, []);

  useEffect(() => {
    reload();
    return () => {
      genRef.current += 1;
    };
  }, [reload]);

  function update(next: string) {
    setAnswer(next);
    const n = Number(next);
    if (token && Number.isFinite(n) && next.trim() !== "") {
      onChangeRef.current({ token, answer: n });
    } else {
      onChangeRef.current(null);
    }
  }

  return (
    <div className="rounded-2xl bg-navy/5 p-3 dark:bg-white/6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-navy">{t("captcha.label")}</p>
        <button
          type="button"
          onClick={reload}
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-navy/8 hover:text-navy"
          aria-label={t("captcha.reload")}
        >
          <RefreshCw className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="inline-flex h-12 min-w-24 items-center justify-center rounded-xl bg-brand px-4 font-semibold tabular-nums tracking-wide text-white">
          {question} = ?
        </span>
        <input
          className="field max-w-24 text-center tabular-nums"
          inputMode="numeric"
          required
          maxLength={3}
          value={answer}
          onChange={(e) => update(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={t("captcha.answer")}
          aria-label={t("captcha.label")}
        />
      </div>
    </div>
  );
}
