import { useEffect, type ReactNode } from "react";
import { Search } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <div
        className="absolute inset-0 bg-navy-deep/45 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-[28px] p-6 glass-strong">
        <h2 className="text-lg font-semibold tracking-tight text-navy">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full px-4 text-sm font-medium text-muted hover:bg-navy/6"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={
              danger
                ? "h-11 rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50"
                : "h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] p-10 text-center glass">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-orange/12 text-orange">
        <Search className="size-6" strokeWidth={2} />
      </div>
      <p className="text-lg font-semibold text-navy">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      {children ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div> : null}
    </div>
  );
}
