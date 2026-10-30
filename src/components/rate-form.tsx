import { useState } from "react";
import { toast } from "sonner";
import { Stars } from "@/components/stars";
import { submitRating, notifyRatingsChanged } from "@/lib/ratings";
import { useT } from "@/lib/locale";

export function RateForm({
  jobId,
  toUserId,
  otherName,
  otherRole,
  onDone,
}: {
  jobId: number;
  toUserId: string;
  otherName: string;
  otherRole: "poster" | "worker";
  onDone?: () => void;
}) {
  const { t } = useT();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const prompt =
    otherRole === "poster" ? t("review.promptPoster", { n: otherName }) : t("review.promptWorker", { n: otherName });

  async function onSubmit() {
    if (stars < 1) {
      toast.error(t("review.pick"));
      return;
    }
    setBusy(true);
    try {
      await submitRating({
        data: {
          jobId,
          toUserId,
          stars,
          comment: comment.trim().slice(0, 150),
        },
      });
      setDone(true);
      toast.success(t("review.thanks"));
      notifyRatingsChanged();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("review.send"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="text-sm font-medium text-navy">{t("review.done", { n: stars })}</p>;
  }

  return (
    <div className="rounded-2xl bg-orange/10 p-4">
      <p className="text-sm font-semibold text-navy">{prompt}</p>
      <p className="mt-1 text-xs text-muted">{t("review.optional")}</p>
      <div className="mt-3">
        <Stars value={stars} onChange={setStars} />
      </div>
      <textarea
        className="field mt-3 min-h-20 py-2.5 text-sm"
        maxLength={150}
        placeholder={t("review.commentPh")}
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 150))}
      />
      <div className="mt-1 text-right text-[11px] text-subtle">{comment.length}/150</div>
      <button
        type="button"
        disabled={busy || stars < 1}
        onClick={() => void onSubmit()}
        className="sheen mt-2 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold glass-orange disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? t("review.sending") : t("review.send")}
      </button>
    </div>
  );
}