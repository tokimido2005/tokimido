import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyInvite } from "@/lib/invites";
import { useT } from "@/lib/locale";

export function InviteCard() {
  const { t } = useT();
  const [code, setCode] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getMyInvite()
      .then((row) => {
        if (!cancelled) {
          setCode(row.code);
          setCount(row.invited);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!code) return null;
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/login?mode=up&invite=${code}`;

  return (
    <section className="mt-5 rounded-[28px] p-5 glass">
      <h2 className="text-base font-semibold text-navy">{t("invite.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("invite.blurb")}</p>
      <p className="mt-2 text-xs font-medium text-subtle">{t("invite.count", { n: count })}</p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(
            () => toast.success(t("invite.copied")),
            () => toast.error(url),
          );
        }}
        className="sheen mt-3 inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold glass-navy"
      >
        {t("invite.copy")}
      </button>
    </section>
  );
}
