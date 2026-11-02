"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

// SCR-J02 sticky Apply bar, above the bottom nav (J-03: one tap, optional note). The server
// makes apply idempotent; the button also locks while a request is in flight.

export type ApplyState = "signedOut" | "canApply" | "applied" | "notJobseeker";

const primary =
  "inline-flex h-12 w-full items-center justify-center rounded-sm bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60";

export function ApplyBar({ jobId, initial }: { jobId: string; initial: ApplyState }) {
  const t = useTranslations("apply");
  const am = useLocale() === "am";
  const [state, setState] = useState(initial);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (res.ok) {
        setState("applied");
      } else {
        const { error: e } = await res.json();
        setError(am ? e.messageAm : e.message);
      }
    } catch {
      setError(t("failed"));
    }
    setBusy(false);
  }

  return (
    <div
      data-testid="apply-bar"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-card px-4 py-3 shadow-overlay"
    >
      <div className="mx-auto flex max-w-[640px] flex-col gap-2">
        {state === "signedOut" && (
          <>
            <Link href={`/login?intent=JOBSEEKER&next=/jobs/${jobId}`} className={primary}>
              {t("signIn")}
            </Link>
            <p className="text-center text-caption text-text-secondary">{t("signInHint")}</p>
          </>
        )}

        {state === "notJobseeker" && (
          <p className="text-center text-small text-text-secondary">{t("employerHint")}</p>
        )}

        {state === "canApply" && (
          <>
            {noteOpen ? (
              <label className="flex flex-col gap-1">
                <span className="text-small font-medium">{t("note")}</span>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={note}
                  placeholder={t("notePlaceholder")}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-sm border border-input bg-card p-2"
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="w-fit text-small text-navy-700 underline underline-offset-4"
              >
                {t("addNote")}
              </button>
            )}
            {error && (
              <p role="alert" className="text-small text-danger-fg">
                {error}
              </p>
            )}
            <button type="button" disabled={busy} onClick={apply} className={primary}>
              {busy ? t("applying") : t("button")}
            </button>
          </>
        )}

        {state === "applied" && (
          <div role="status" className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-semibold text-success-fg">
              <CircleCheck className="size-5" aria-hidden />
              {t("applied")}
            </span>
            <Link
              href="/me/applications"
              className="text-small text-navy-700 underline underline-offset-4"
            >
              {t("view")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
