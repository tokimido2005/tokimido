import { errorText } from "@/lib/i18n";
import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { getProfileGate, saveMyProfile } from "@/lib/profile";
import { checkPhoneAvailable } from "@/lib/safety";
import { seoHead } from "@/lib/seo";
import { Shell } from "@/components/shell";
import { Logo } from "@/components/logo";
import { RulesAccept } from "@/components/rules-accept";
import { PhoneLocked } from "@/components/phone-verify";
import { safeNextPath } from "@/components/social-auth";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useT } from "@/lib/locale";
import { birthYearRange, isValidBirthYear } from "@/lib/age";

type CompleteSearch = { next?: string };

export const Route = createFileRoute("/complete")({
  validateSearch: (s: Record<string, unknown>): CompleteSearch => ({
    next: safeNextPath(typeof s.next === "string" ? s.next : undefined),
  }),
  head: () => seoHead("Finalizează contul", "Adaugă telefonul și acceptă regulile pentru a activa contul.", { noindex: true }),
  component: CompleteProfile,
});

function splitDisplayName(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function verifyHref(next?: string) {
  return next ? `/verify?next=${encodeURIComponent(next)}` : "/verify";
}

function CompleteProfile() {
  const { t } = useT();
  const { next } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const fromName = splitDisplayName(user?.displayName);
  const [firstName, setFirstName] = useState(fromName.first);
  const [lastName, setLastName] = useState(fromName.last);
  const [phone, setPhone] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [birthYear, setBirthYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<{ complete: boolean; verified: boolean; admin: boolean; phone: string } | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;
    const split = splitDisplayName(user.displayName);
    setFirstName((prev) => prev || split.first);
    setLastName((prev) => prev || split.last);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getProfileGate()
      .then((g) => {
        if (!cancelled) {
          setGate(g);
          if (g.phone) setPhone(g.phone);
        }
      })
      .catch(() => {
        if (!cancelled) setGate({ complete: false, verified: false, admin: false, phone: "" });
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dest = !gate
    ? null
    : gate.verified
      ? (next ?? (gate.admin ? "/admin" : "/"))
      : gate.complete && gate.phone
        ? verifyHref(next)
        : null;

  useEffect(() => {
    if (dest) window.location.replace(dest);
  }, [dest]);

  if (isPending) {
    return (
      <Shell>
        <main className="mx-auto max-w-lg px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (!gate || dest) {
    return (
      <Shell>
        <main className="mx-auto max-w-lg px-4 py-16">
          <div className="h-80 animate-pulse rounded-[32px] bg-white/40 dark:bg-white/8" />
        </main>
      </Shell>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accepted || !ageConfirmed) {
      setError(t("login.ageAndTerms"));
      return;
    }
    const by = Number(birthYear);
    if (!isValidBirthYear(by)) {
      setError(t("age.yearInvalid", { max: birthYearRange().max }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await checkPhoneAvailable({ data: phone.trim() });
      await saveMyProfile({
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: (gate?.phone || phone).trim(),
          birth_year: by,
        },
      });
      window.location.href = verifyHref(next);
    } catch (err) {
      setError(errorText(err, t, t("complete.submit")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <main className="mx-auto flex max-w-lg flex-col px-4 py-12 pb-24 sm:px-6">
        <div className="rounded-[32px] p-6 glass-strong sm:p-8" data-testid="complete-form">
          <Logo size="lg" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-navy">{t("complete.title")}</h1>
          <p className="mt-2 text-sm text-muted">{t("complete.blurb")}</p>

          <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="field"
                required
                minLength={2}
                placeholder={t("apply.firstName")}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
              <input
                className="field"
                required
                minLength={2}
                placeholder={t("apply.lastName")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div>
              {gate.phone ? (
                <>
                  <PhoneLocked phone={gate.phone || phone} />
                  <p className="mt-1.5 text-xs text-muted">{t("verify.changeHint")}</p>
                </>
              ) : (
                <>
                  <input
                    className="field"
                    required
                    minLength={8}
                    placeholder={t("apply.phone")}
                    data-testid="complete-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                  <p className="mt-1.5 text-xs text-muted">{t("login.phoneHint")}</p>
                </>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-navy">{t("age.yearLabel")}</span>
              <input
                className="field mt-1 tabular-nums"
                required
                inputMode="numeric"
                maxLength={4}
                placeholder="1990"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                data-testid="complete-birth-year"
              />
              <span className="mt-1 block text-xs text-muted">{t("age.yearHint")}</span>
            </label>

            <RulesAccept
              accepted={accepted}
              onToggle={() => setAccepted((v) => !v)}
              ageConfirmed={ageConfirmed}
              onAgeToggle={() => setAgeConfirmed((v) => !v)}
            />

            {error ? (
              <p className="text-sm text-danger" data-testid="complete-error">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!accepted || !ageConfirmed || busy}
              data-testid="complete-submit"
              className="sheen flex h-12 w-full items-center justify-center rounded-full text-sm font-semibold glass-orange disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? t("complete.busy") : t("complete.submit")}
            </button>
          </form>
        </div>
      </main>
    </Shell>
  );
}
