import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { REPORT_REASONS, type ReportReason, errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { submitReport } from "@/lib/community";
import { track } from "@/lib/analytics";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "job" | "user";
  targetId: string;
}) {
  const { t } = useT();
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("false");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSend() {
    if (!user) {
      await navigate({ to: "/login", search: { next: typeof window === "undefined" ? "/" : window.location.pathname } });
      return;
    }
    setBusy(true);
    try {
      await submitReport({
        data: { targetType, targetId, reason, details: details.trim() },
      });
      track("report_submit", { type: targetType });
      toast.success(t("report.sent"));
      setOpen(false);
      setDetails("");
    } catch (err) {
      toast.error(errorText(err, t, t("report.send")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-navy/6 hover:text-navy"
      >
        <Flag className="size-3.5" />
        {t("job.report")}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl p-4 glass-strong">
          <p className="text-sm font-semibold text-navy">
            {targetType === "job" ? t("report.job") : t("report.user")}
          </p>
          <label className="mt-3 block text-xs font-medium text-muted">{t("report.reason")}</label>
          <select
            className="field mt-1 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`report.${r}`)}
              </option>
            ))}
          </select>
          <textarea
            className="field mt-2 min-h-16 py-2 text-sm"
            maxLength={400}
            placeholder={t("report.details")}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSend()}
              className="sheen h-11 flex-1 rounded-full text-sm font-semibold glass-orange disabled:opacity-50"
            >
              {t("report.send")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 rounded-full px-3 text-sm font-medium text-muted"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
