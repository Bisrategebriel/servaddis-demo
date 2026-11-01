"use client";

import { RotateCcw, Wrench, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { PERSONAS, type DemoStatus, type PersonaKey } from "@/lib/demo";

const post = (path: string, body?: unknown) =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// A full load, not client navigation: the language, and with it the root layout, may change.
const goTo = (path: string) => window.location.replace(new URL(path, window.location.origin).href);

export default function DemoPanel({ status }: { status: DemoStatus }) {
  const t = useTranslations("demo");
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(status.locked);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [passcode, setPasscode] = useState("");

  async function run(action: () => Promise<Response>, then: (res: Response) => Promise<void>) {
    setBusy(true);
    setFailed(false);
    const res = await action().catch(() => null);
    if (res?.ok) await then(res);
    else setFailed(true);
    setBusy(false);
  }

  const followRedirect = async (res: Response) => goTo((await res.json()).redirectTo);
  const switchTo = (persona: PersonaKey) =>
    run(() => post("/api/demo/persona", { persona }), followRedirect);
  const reset = () => run(() => post("/api/demo/reset"), followRedirect);

  function unlock(e: FormEvent) {
    e.preventDefault();
    void run(
      () => post("/api/demo/unlock", { passcode }),
      async () => setLocked(false),
    );
  }

  // Top-right on phones, so it never covers the bottom nav or sticky Apply bar (doc 04 §4).
  const position = "fixed top-16 right-2 z-40 md:top-auto md:right-4 md:bottom-4";

  if (!open) {
    return (
      <button
        type="button"
        aria-label={t("open")}
        onClick={() => setOpen(true)}
        className={`${position} inline-flex size-11 items-center justify-center rounded-full bg-navy-700 text-white shadow-overlay hover:bg-navy-600`}
      >
        <Wrench className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <aside
      aria-label={t("title")}
      className={`${position} flex max-h-[calc(100vh-5rem)] w-72 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-overlay`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-h3">{t("title")}</h2>
        <button
          type="button"
          aria-label={t("close")}
          onClick={() => setOpen(false)}
          className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-muted"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {locked ? (
        <form onSubmit={unlock} className="flex flex-col gap-2">
          <label htmlFor="toolkit-code" className="text-small font-medium">
            {t("passcode")}
          </label>
          <input
            id="toolkit-code"
            inputMode="numeric"
            autoComplete="off"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="h-11 rounded-sm border border-input bg-card px-3"
          />
          <Button type="submit" disabled={busy || !passcode} className="h-11">
            {t("unlock")}
          </Button>
        </form>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-caption text-text-secondary">{t("personas")}</p>
            {PERSONAS.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={busy}
                onClick={() => switchTo(p.key)}
                className="min-h-10 rounded-lg px-3 py-1.5 text-left text-small hover:bg-accent disabled:opacity-50"
              >
                {t(`persona.${p.key}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <Button
              variant={confirming ? "destructive" : "outline"}
              disabled={busy}
              className="h-10"
              onClick={() => (confirming ? reset() : setConfirming(true))}
            >
              <RotateCcw aria-hidden />
              {busy && confirming ? t("resetting") : confirming ? t("resetConfirm") : t("reset")}
            </Button>
            <p className="text-caption text-text-secondary">
              {t("seedVersion", { version: status.seedVersion })}
            </p>
            {status.resetNeeded && (
              <p role="status" className="text-caption text-warning-fg">
                {t("resetNeeded")}
              </p>
            )}
          </div>
        </>
      )}
      {failed && (
        <p role="alert" className="text-small text-danger-fg">
          {t("failed")}
        </p>
      )}
    </aside>
  );
}
