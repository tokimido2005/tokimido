import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { useT } from "@/lib/locale";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  const { t } = useT();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || isPending) {
    return <div className="h-10 w-28 animate-pulse rounded-full bg-navy/10" />;
  }

  if (!user) {
    return (
      <Link
        to="/login"
        search={{ next: "/" }}
        className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-navy transition-transform duration-150 active:scale-[0.96]"
      >
        {t("auth.signIn")}
      </Link>
    );
  }

  const label = user.displayName ?? user.primaryEmail ?? "Cont";

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/cont"
        className="flex min-h-10 items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-navy/6"
      >
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="size-8 rounded-full object-cover outline outline-1 -outline-offset-1 outline-navy/10"
          />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="max-w-28 truncate text-sm font-medium text-navy">{label}</span>
      </Link>
      <button
        type="button"
        onClick={() => void signOut("/")}
        className="h-10 rounded-full px-3 text-sm font-medium text-muted transition-colors hover:text-navy"
      >
        {t("auth.signOut")}
      </button>
    </div>
  );
}
