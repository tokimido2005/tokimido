import { useEffect, useState, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useT } from "@/lib/locale";
import { listFavoriteIds, toggleFavorite } from "@/lib/community";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

export function useSavedIds() {
  const { user } = useCurrentUserState();
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    listFavoriteIds()
      .then((rows) => {
        if (!cancelled) setIds(new Set(rows));
      })
      .catch(() => {
        if (!cancelled) setIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function setSaved(jobId: number, saved: boolean) {
    setIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  }

  return { ids, setSaved };
}

export function FavoriteButton({
  jobId,
  saved,
  onChange,
  className,
}: {
  jobId: number;
  saved?: boolean;
  onChange?: (saved: boolean) => void;
  className?: string;
}) {
  const { t } = useT();
  const { user } = useCurrentUserState();
  const navigate = useNavigate();
  const [on, setOn] = useState(Boolean(saved));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOn(Boolean(saved));
  }, [saved]);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      const next =
        typeof window === "undefined"
          ? "/"
          : `${window.location.pathname}${window.location.search}`;
      await navigate({ to: "/login", search: { next: next.startsWith("/") ? next : "/" } });
      return;
    }
    if (busy) return;
    const next = !on;
    setOn(next);
    onChange?.(next);
    setBusy(true);
    try {
      const res = await toggleFavorite({ data: jobId });
      setOn(res.saved);
      onChange?.(res.saved);
    } catch (err) {
      setOn(!next);
      onChange?.(!next);
      toast.error(err instanceof Error ? err.message : t("job.save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void toggle(e)}
      aria-label={on ? t("job.saved") : t("job.save")}
      className={cn(
        "grid size-10 place-items-center rounded-full bg-white/80 text-navy ring-1 ring-navy/10 hover:bg-white dark:bg-white/12 dark:hover:bg-white/16",
        className,
      )}
    >
      <Heart className={cn("size-4 transition-[fill,color] duration-150", on && "fill-orange text-orange")} />
    </button>
  );
}
