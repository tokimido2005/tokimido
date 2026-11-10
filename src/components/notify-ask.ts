/**
 * Tiny entry point to ask for notifications from anywhere. The window itself
 * (<NotifyPrompt>) loads after the page is idle; a request made before it is
 * ready is kept in sessionStorage and picked up when it mounts.
 */
export type NotifyReason = "signup" | "auto" | "apply" | "post" | "search" | "manual" | "telegram";

export const NOTIFY_EVENT = "rbt-notify-ask";
export const NOTIFY_PENDING_KEY = "rbt-notify-pending";

export function askNotifications(reason: NotifyReason) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NOTIFY_PENDING_KEY, reason);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(NOTIFY_EVENT, { detail: reason }));
}
