"use client";

import { UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

// doc 04 LiveToast: "New applicant: Dawit A. — Barista" with a View action. Auto-dismisses after
// 6 s and pauses while hovered or focused. Bottom-centre on phones, top-right on desktop.

export type Toast = { id: string; text: string; href: string | null };

const LIFETIME_MS = 6000;

function ToastItem({
  toast,
  onView,
  onClose,
}: {
  toast: Toast;
  onView: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("toast");
  const [paused, setPaused] = useState(false);
  const left = useRef(LIFETIME_MS);
  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(onClose, left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [paused, onClose]);

  return (
    <div
      data-testid="live-toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex w-full items-center gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-white shadow-overlay"
    >
      <UserPlus className="size-5 shrink-0 text-amber-400" aria-hidden />
      <p className="min-w-0 flex-1 text-small">{toast.text}</p>
      {toast.href && (
        <button
          type="button"
          onClick={onView}
          className="min-h-10 shrink-0 rounded-sm px-2 text-small font-semibold text-amber-400 underline underline-offset-4"
        >
          {t("view")}
        </button>
      )}
      <button
        type="button"
        aria-label={t("dismiss")}
        onClick={onClose}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm hover:bg-navy-800"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function LiveToasts({
  toasts,
  onView,
  onClose,
}: {
  toasts: Toast[];
  onView: (t: Toast) => void;
  onClose: (id: string) => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-sm flex-col gap-2 md:inset-x-auto md:top-16 md:right-4 md:bottom-auto"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onView={() => onView(t)} onClose={() => onClose(t.id)} />
      ))}
    </div>
  );
}
