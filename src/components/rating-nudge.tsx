import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { listPendingRatings, RATINGS_CHANGED_EVENT } from "@/lib/ratings";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useT } from "@/lib/locale";

export function RatingNudge() {
  const { t } = useT();
  const { user, isPending } = useCurrentUserState();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;
    function load() {
      listPendingRatings()
        .then((rows) => {
          if (!cancelled) setCount(rows.length);
        })
        .catch(() => {
          if (!cancelled) setCount(0);
        });
    }
    load();
    window.addEventListener(RATINGS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(RATINGS_CHANGED_EVENT, load);
    };
  }, [user]);

  if (isPending || !user || count === 0) return null;

  return (
    <Link
      to="/cont"
      search={{ tab: "ratings" }}
      className="relative inline-flex h-10 items-center rounded-full bg-orange/15 px-3 text-sm font-semibold text-orange-deep md:inline-flex"
      title={t("nudge.pending")}
    >
      <Star className="size-4 fill-orange text-orange" />
      <span className="ml-1.5 tabular-nums">{count}</span>
    </Link>
  );
}
