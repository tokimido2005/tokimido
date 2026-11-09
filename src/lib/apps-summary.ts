import { useEffect, useSyncExternalStore } from "react";
import { getAppsSummary } from "@/lib/jobs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export type SelectedApp = { id: number; job_id: number; title: string; starts_at: string | null };
type Summary = { newApplicants: number; selected: SelectedApp[] };

const SEEN_KEY = "rabotaem-seen-selected";
const EMPTY: Summary = { newApplicants: 0, selected: [] };

let state: { summary: Summary; seen: number[] } = { summary: EMPTY, seen: [] };
const listeners = new Set<() => void>();
let lastFetch = 0;
let inflight: Promise<void> | null = null;
let users = 0;
let timer = 0;

function emit() {
  for (const l of listeners) l();
}

function readSeen(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((n): n is number => typeof n === "number").slice(-200) : [];
  } catch {
    return [];
  }
}

/** Fetch the counters again (throttled unless forced). */
export function refreshAppsSummary(force = false) {
  if (typeof window === "undefined") return Promise.resolve();
  if (!force && Date.now() - lastFetch < 20_000) return inflight ?? Promise.resolve();
  lastFetch = Date.now();
  inflight = getAppsSummary()
    .then((summary) => {
      state = { summary, seen: readSeen() };
      emit();
    })
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Remember that the user has seen these selections (banner and badge go away). */
export function markSelectedSeen(ids: number[]) {
  if (ids.length === 0) return;
  const seen = [...new Set([...readSeen(), ...ids])].slice(-200);
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
  state = { ...state, seen };
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverSnapshot = { summary: EMPTY, seen: [] as number[] };

/** Counters for the Applications menu; polls gently while the tab is visible. */
export function useAppsSummary() {
  const { user } = useCurrentUserState();
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot,
  );

  useEffect(() => {
    if (!user) {
      state = { summary: EMPTY, seen: [] };
      emit();
      return;
    }
    users += 1;
    void refreshAppsSummary(users === 1);
    const onFocus = () => {
      if (document.visibilityState === "visible") void refreshAppsSummary();
    };
    if (users === 1) {
      timer = window.setInterval(onFocus, 90_000);
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      users -= 1;
      if (users === 0) window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user]);

  const unseen = user ? snap.summary.selected.filter((s) => !snap.seen.includes(s.id)) : [];
  const newApplicants = user ? snap.summary.newApplicants : 0;
  return { newApplicants, unseen, selected: user ? snap.summary.selected : [], badge: newApplicants + unseen.length };
}
