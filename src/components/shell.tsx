import { useEffect, useState, type ReactNode } from "react";
import { Ambient } from "@/components/ambient";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Onboarding } from "@/components/onboarding";
import { lazy } from "react";
import { AfterIdle } from "@/components/after-idle";

// The assistant bubble (with all its answers) loads after the page is usable.
const Chatbot = lazy(() => import("@/components/chatbot").then((m) => ({ default: m.Chatbot })));
import { TabBar } from "@/components/tab-bar";
import { SelectedBanner } from "@/components/selected-banner";

export function Shell({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState(false);
  useEffect(() => {
    const delay = window.matchMedia("(max-width: 640px)").matches ? 3200 : 1800;
    const idle = "requestIdleCallback" in window ? window.requestIdleCallback : null;
    let idleId = 0;
    const id = window.setTimeout(() => {
      if (idle) {
        idleId = idle(() => setChat(true), { timeout: 2000 });
      } else {
        setChat(true);
      }
    }, delay);
    return () => {
      window.clearTimeout(id);
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
    };
  }, []);
  return (
    <div className="relative min-h-dvh pb-[5.8rem] lg:pb-0">
      <Ambient />
      <Header />
      <SelectedBanner />
      {children}
      <Footer />
      <Onboarding />
      {chat ? (
        <AfterIdle>
          <Chatbot />
        </AfterIdle>
      ) : null}
      <TabBar />
    </div>
  );
}
