import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient, authEnabled } from "@/lib/auth/client";
import { saveMyProfile, getProfileGate } from "@/lib/profile";
import { checkPhoneAvailable } from "@/lib/safety";
import { verifyCaptcha } from "@/lib/captcha";
import { track } from "@/lib/analytics";
import { seoHead } from "@/lib/seo";
import { Shell } from "@/components/shell";
import { Logo } from "@/components/logo";
import { CaptchaField, type CaptchaValue } from "@/components/captcha-field";
import { RulesAccept } from "@/components/rules-accept";
import { SocialAuthButtons } from "@/components/social-auth";
import { useT } from "@/lib/locale";
import { useMoneyMode } from "@/lib/money-mode";
import { getAdminSession, primeAdmin } from "@/lib/admin";
import { ADMIN_USERNAME, isAdminEmail, resolveLoginIdentifier } from "@/lib/admin-public";

type LoginSearch = { next?: string; mode?: "up"; invite?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && s.next !== "/" ? s.next : undefined,
    mode: s.mode === "up" ? "up" : undefined,
    invite: typeof s.invite === "string" && s.invite.length >= 4 && s.invite.length <= 16 ? s.invite : undefined,
  }),
  head: () => seoHead("Autentificare", "Intră sau creează un cont Rabotaem.md."),
  component: Login,
});

function Login() {
  const { t } = useT();
  const { showPro } = useMoneyMode();
  const { next, mode: modeFromUrl, invite } = Route.useSearch();
  const navigate = useNavigate({ from: "/login" });
  const mode: "in" | "up" = modeFromUrl === "up" ? "up" : "in";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMode() {
    setError(null);
    setAccepted(false);
    void navigate({
      search: { next, mode: mode === "in" ? "up" : undefined },
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        if (!accepted) throw new Error(t("login.agree"));
        if (!captcha) throw new Error(t("captcha.required"));
        await verifyCaptcha({ data: captcha });
        await checkPhoneAvailable({ data: phone.trim() });
        const res = await authClient.signUp.email({
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          email: email.trim(),
          password,
        });
        if (res.error) throw new Error(res.error.message ?? t("login.titleUp"));
        const session = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (session.error) throw new Error(session.error.message ?? t("login.submitIn"));
        await saveMyProfile({
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
          },
        });
        if (invite) {
          try {
            const { redeemInvite } = await import("@/lib/invites");
            await redeemInvite({ data: invite });
          } catch {
            /* ignore */
          }
        }
        track("signup");
        const finish = next ? `/complete?next=${encodeURIComponent(next)}` : "/complete";
        window.location.href = finish;
        return;
      } else {
        await primeAdmin();
        const identifier = resolveLoginIdentifier(email);
        const res = await authClient.signIn.email({
          email: identifier,
          password,
          callbackURL: next ?? "/",
        });
        if (res.error) throw new Error(res.error.message ?? t("login.submitIn"));
        track("login");
        const signedEmail = res.data?.user?.email ?? identifier;
        if (isAdminEmail(signedEmail) || email.trim().toLowerCase() === ADMIN_USERNAME) {
          window.location.href = "/admin";
          return;
        }
        try {
          const session = await getAdminSession();
          if (session.admin) {
            window.location.href = "/admin";
            return;
          }
        } catch {
          /* continue */
        }
        try {
          const gate = await getProfileGate();
          if (!gate.complete) {
            window.location.href = next ? `/complete?next=${encodeURIComponent(next)}` : "/complete";
            return;
          }
          if (!gate.verified) {
            window.location.href = next ? `/verify?next=${encodeURIComponent(next)}` : "/verify";
            return;
          }
        } catch {
          /* continue */
        }
        window.location.href = next ?? "/";
        return;
      }
      window.location.href = next ?? "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.submitIn"));
    } finally {
      setBusy(false);
    }
  }

  const canCreate = accepted && !busy;

  return (
    <Shell>
      <main className="mx-auto flex max-w-lg flex-col px-4 py-12 pb-24 sm:px-6">
        <div className="rounded-[32px] p-6 glass-strong sm:p-8">
          <Logo size="lg" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-navy">
            {mode === "in" ? t("login.titleIn") : t("login.titleUp")}
          </h1>
          <p className="mt-2 text-sm text-muted">{showPro ? t("login.blurbPaid") : t("login.blurb")}</p>

          {mode === "up" ? (
            <div className="mt-6">
              <RulesAccept accepted={accepted} onToggle={() => setAccepted((v) => !v)} />
            </div>
          ) : null}

          {authEnabled ? (
            <>
              <div className={mode === "up" ? "mt-4" : "mt-6"}>
                <SocialAuthButtons next={next} locked={mode === "up" && !accepted} />
              </div>
              <div className="my-6 flex items-center gap-3 text-xs font-medium tracking-wide text-subtle uppercase">
                <span className="h-px flex-1 bg-navy/12" />
                {t("login.orEmail")}
                <span className="h-px flex-1 bg-navy/12" />
              </div>
            </>
          ) : (
            <div className="mt-6" />
          )}

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            {mode === "up" ? (
              <>
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
                  <input
                    className="field"
                    required
                    minLength={8}
                    placeholder={t("apply.phone")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                  <p className="mt-1.5 text-xs text-muted">{t("login.phoneHint")}</p>
                </div>
              </>
            ) : null}
            <input
              className="field"
              type={mode === "in" ? "text" : "email"}
              required
              placeholder={mode === "in" ? t("login.identifier") : t("login.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={mode === "in" ? "username" : "email"}
              inputMode={mode === "in" ? "text" : "email"}
            />
            <input
              className="field"
              type="password"
              required
              minLength={8}
              placeholder={t("login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />

            {mode === "up" ? <CaptchaField onChange={setCaptcha} /> : null}

            {mode === "in" ? (
              <Link to="/reset" className="block text-right text-sm font-medium text-orange" data-testid="forgot-password">
                {t("login.forgot")}
              </Link>
            ) : null}

            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <button
              type="submit"
              disabled={mode === "up" ? !canCreate : busy}
              className="sheen flex h-12 w-full items-center justify-center rounded-full glass-orange text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? t("login.busy") : mode === "in" ? t("login.submitIn") : t("login.submitUp")}
            </button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-muted hover:text-navy"
            onClick={toggleMode}
          >
            {mode === "in" ? t("login.needAccount") : t("login.haveAccount")}
          </button>
        </div>
        <Link to="/" className="mt-6 text-center text-sm text-muted hover:text-navy">
          {t("login.back")}
        </Link>
      </main>
    </Shell>
  );
}
