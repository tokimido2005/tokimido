import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { isRuPath } from "@/lib/lang-paths";
import { AuthProvider } from "@/lib/auth/provider";
import { LocaleProvider } from "@/lib/locale";
import { ThemeProvider, ThemedToaster } from "@/lib/theme";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { WelcomeSplash } from "@/components/welcome-splash";
import { PwaRegister, PushNavigateListener } from "@/components/pwa-register";
import { RatingPrompt } from "@/components/rating-prompt";
import { PushPrompt } from "@/components/push-prompt";
import { BanGate } from "@/components/ban-screen";
import { ProfileGate } from "@/components/profile-gate";
import { MoneyModeProvider } from "@/lib/money-mode";
import "@/lib/sentry";
import appCss from "../styles.css?url";

const APP_NAME = "Rabotaem.md";
const host = import.meta.env.VITE_PUBLIC_HOSTNAME;
const ogImage = host ? `https://${host}/og.jpg` : undefined;

const THEME_BOOT = `(function(){try{var h=document.documentElement;h.style.backgroundColor="#071422";h.style.colorScheme="dark";if(document.body)document.body.style.backgroundColor="#071422";var t=localStorage.getItem("rabotaem-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)h.classList.add("dark");var k="rabotaem-splash-v23";var seen=sessionStorage.getItem(k)==="1"||location.pathname!=="/"||(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)||/bot|crawl|spider|lighthouse|headless/i.test(navigator.userAgent);window.__RBT_SPLASH_PLAY=!seen;if(seen){h.classList.add("rbt-splash-done");if(!d){h.style.colorScheme="light";h.style.backgroundColor="#dce6f0";if(document.body)document.body.style.backgroundColor="#dce6f0"}}else{try{sessionStorage.setItem(k,"1")}catch(e){}h.classList.add("rbt-splash");setTimeout(function(){if(!h.classList.contains("rbt-splash-done")){h.classList.remove("rbt-splash","is-reveal");h.classList.add("rbt-splash-done")}},1600)}}catch(e){document.documentElement.classList.add("rbt-splash");document.documentElement.style.backgroundColor="#071422"}})();`;
const ANALYTICS_BOOT = `window.dataLayer=window.dataLayer||[];window.rabotaemTrack=window.rabotaemTrack||function(){};`;
const SPLASH_LOCK = `html,body{background-color:#071422!important;color-scheme:dark}html.rbt-splash-done:not(.dark),html.rbt-splash-done:not(.dark) body,html.rbt-splash.is-reveal:not(.dark),html.rbt-splash.is-reveal:not(.dark) body{background-color:#dce6f0!important;color-scheme:light}html.rbt-splash-done.dark,html.rbt-splash-done.dark body,html.rbt-splash.is-reveal.dark,html.rbt-splash.is-reveal.dark body{background-color:#071422!important;color-scheme:dark}html.rbt-splash-done .splash,html.rbt-splash-done .splash-overlay{display:none!important}.splash{position:fixed;inset:0;z-index:9999;overflow:hidden;width:100%;height:100%;min-height:100dvh;background:transparent;animation:rbt-blur 2800ms linear both}.splash-veil{position:absolute;inset:0;background:#071422;animation:rbt-veil 2800ms ease both}.splash-logo{position:absolute;left:50%;top:50%;translate:-50% -50%;width:min(78vw,560px);height:auto;display:block;opacity:0;animation:rbt-logo-io 2800ms ease both}@keyframes rbt-veil{0%,30%{opacity:1}48%,100%{opacity:0}}@keyframes rbt-logo-io{0%,8%{opacity:0}28%,62%{opacity:1}100%{opacity:0}}@keyframes rbt-blur{0%,30%{-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0)}48%,62%{-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}100%{-webkit-backdrop-filter:blur(0);backdrop-filter:blur(0)}}@media (max-width:1023px){.splash{animation:none!important;pointer-events:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}.splash-veil{animation:rbt-veil-m 1400ms ease both!important}.splash-logo{animation:rbt-logo-m 1400ms ease both!important}}@keyframes rbt-veil-m{0%,18%{opacity:1}70%,100%{opacity:0}}@keyframes rbt-logo-m{0%{opacity:0}22%,55%{opacity:1}100%{opacity:0}}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Kalîmuri și lucru pe zi în toată Moldova. Plata în aceeași zi, fără comision, gratuit.",
      },
      { name: "apple-mobile-web-app-title", content: "Rabotaem" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "theme-color", content: "#071422" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: APP_NAME },
      {
        property: "og:description",
        content: "Lucru pe loc. Bani pe loc. Complet gratuit.",
      },
      ...(ogImage
        ? [
            { property: "og:image", content: ogImage },
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=r6" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png?v=r6" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png?v=r6" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png?v=r6" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png?v=r6" },
      { rel: "shortcut icon", href: "/favicon.ico?v=r6" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=r6" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  return (
    <html lang={isRuPath(pathname) ? "ru" : "ro"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: ANALYTICS_BOOT }} />
        <style dangerouslySetInnerHTML={{ __html: SPLASH_LOCK }} />
        <HeadContent />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <WelcomeSplash />
        <PreviewHostBridge />
        <AuthProvider>
          <LocaleProvider>
            <ThemeProvider>
              <MoneyModeProvider>
              <PushNavigateListener />
              <BanGate>
                <ProfileGate>
                  <div className="rbt-app">
                    <Outlet />
                  </div>
                </ProfileGate>
                <PwaRegister />
                <PushPrompt />
                <RatingPrompt />
              </BanGate>
              <ThemedToaster />
              </MoneyModeProvider>
            </ThemeProvider>
          </LocaleProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
