import { useState } from "react";
import { EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Stars } from "@/components/stars";
import { errorText } from "@/lib/i18n";
import { useT } from "@/lib/locale";
import { COMMENT_MAX, MAX_TAGS, tagsFor } from "@/lib/rating-tags";
import { notifyRatingsChanged, skipRating, submitRating } from "@/lib/ratings";
import { cn } from "@/lib/utils";

const STAR_LABEL_KEYS = ["", "review.star1", "review.star2", "review.star3", "review.star4", "review.star5"];

/**
 * Rate the other side of a job: 1–5 stars (required), quick tags and a short
 * comment (optional), or "the job didn't happen". Used inline (account and
 * applications pages) and inside the rating pop-up.
 */
export function RateForm({
  jobId,
  toUserId,
  otherName,
  otherRole,
  onDone,
  variant = "inline",
}: {
  jobId: number;
  toUserId: string;
  otherName: string;
  otherRole: "poster" | "worker";
  onDone?: () => void;
  variant?: "inline" | "dialog";
}) {
  const { t } = useT();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "rated" | "skipped">(null);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const options = tagsFor(otherRole, stars);
  const prompt =
    otherRole === "poster" ? t("review.promptPoster", { n: otherName }) : t("review.promptWorker", { n: otherName });

  function pickStars(n: number) {
    // Switching between "good" (4–5) and "bad" (1–3) changes the tag list.
    if ((n >= 4) !== (stars >= 4)) setTags([]);
    setStars(n);
  }

  function toggleTag(tag: string) {
    setTags((cur) =>
      cur.includes(tag) ? cur.filter((x) => x !== tag) : cur.length >= MAX_TAGS ? cur : [...cur, tag],
    );
  }

  async function onSubmit() {
    if (stars < 1) {
      toast.error(t("review.pick"));
      return;
    }
    setBusy(true);
    try {
      await submitRating({
        data: { jobId, toUserId, stars, tags, comment: comment.trim().slice(0, COMMENT_MAX) },
      });
      setDone("rated");
      toast.success(t("review.thanks"));
      notifyRatingsChanged();
      onDone?.();
    } catch (err) {
      toast.error(errorText(err, t, t("review.send")));
    } finally {
      setBusy(false);
    }
  }

  async function onSkip() {
    setBusy(true);
    try {
      await skipRating({ data: { jobId, toUserId } });
      setDone("skipped");
      toast.success(t("review.skipDone"));
      notifyRatingsChanged();
      onDone?.();
    } catch (err) {
      toast.error(errorText(err, t, t("review.send")));
    } finally {
      setBusy(false);
    }
  }

  if (done === "rated") {
    return <p className="text-sm font-medium text-navy">{t("review.done", { n: stars })}</p>;
  }
  if (done === "skipped") {
    return <p className="text-sm font-medium text-navy">{t("review.skipDone")}</p>;
  }

  return (
    <div className={cn(variant === "inline" && "rounded-2xl bg-orange/10 p-4")} data-testid="rate-form">
      {variant === "inline" ? <p className="text-sm font-semibold text-navy">{prompt}</p> : null}

      <div className={cn("flex flex-col items-center", variant === "inline" ? "mt-3" : "mt-1")}>
        <Stars value={stars} onChange={pickStars} size="lg" />
        <p className="mt-1 min-h-5 text-sm text-muted" aria-live="polite">
          {stars ? t(STAR_LABEL_KEYS[stars]) : t("review.tapStar")}
        </p>
      </div>

      {options.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="rate-tags">
          {options.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-medium ring-1 transition-colors",
                  on ? "bg-orange/15 text-orange-deep ring-orange/50" : "text-navy ring-navy/15 hover:bg-navy/5",
                )}
              >
                {t(`rtag.${tag}`)}
              </button>
            );
          })}
        </div>
      ) : null}

      <textarea
        className="field mt-3 min-h-20 py-2.5 text-sm"
        maxLength={COMMENT_MAX}
        placeholder={t("review.commentPh")}
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
        data-testid="rate-comment"
      />
      <div className="mt-1 flex items-start justify-between gap-3 text-[11px] text-subtle">
        <span className="inline-flex items-start gap-1">
          <EyeOff className="mt-px size-3 shrink-0" aria-hidden />
          {t("review.blindHint", { n: otherName })}
        </span>
        <span className="tabular-nums">
          {comment.length}/{COMMENT_MAX}
        </span>
      </div>

      <button
        type="button"
        disabled={busy || stars < 1}
        onClick={() => void onSubmit()}
        data-testid="rate-submit"
        className="sheen mt-3 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold glass-orange disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? t("review.sending") : t("review.send")}
      </button>

      {confirmSkip ? (
        <div className="mt-3 rounded-xl bg-navy/5 p-3 text-sm text-navy">
          <p>{t("review.skipConfirm", { n: otherName })}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSkip()}
              data-testid="rate-skip-confirm"
              className="h-9 rounded-full bg-navy px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {t("review.skipYes")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmSkip(false)}
              className="h-9 rounded-full px-3 text-xs font-medium text-muted hover:bg-navy/6"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmSkip(true)}
          data-testid="rate-skip"
          className="mt-2 w-full py-1.5 text-center text-xs font-medium text-muted hover:text-navy"
        >
          {t("review.skip")}
        </button>
      )}
    </div>
  );
}
