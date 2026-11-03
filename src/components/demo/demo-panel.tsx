"use client";

import { Presentation, RotateCcw, Wrench, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { SimulatedTag } from "@/components/simulated-tag";
import { Button } from "@/components/ui/button";
import { PERSONAS, type DemoStatus, type PersonaKey } from "@/lib/demo";
import { setPresenter, usePresenter } from "@/lib/presenter";

const post = (path: string, body?: unknown) =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// A full load, not client navigation: the language, and with it the root layout, may change.
const goTo = (path: string) => window.location.replace(new URL(path, window.location.origin).href);

type Sms = { id: string; toPhone: string; body: string };

/** doc 04 §8: the presenter-mode switch, first in the panel. */
function PresenterSwitch() {
  const t = useTranslations("demo");
  const on = usePresenter();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-testid="presenter-switch"
      onClick={() => setPresenter(!on)}
      className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-left hover:bg-accent"
    >
      <Presentation className="size-5 shrink-0 text-text-secondary" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-small font-medium">{t("presenter")}</span>
        <span className="text-caption text-text-secondary">{t("presenterHint")}</span>
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-gray-300"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-card transition-[left] duration-150 ease-out ${on ? "left-4.5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

/** The simulated SMS gateway's outbox, loaded when opened (doc 03 §10). */
function SmsLog() {
  const t = useTranslations("demo");
  const [items, setItems] = useState<Sms[] | null>(null);
  async function load() {
    const res = await fetch("/api/demo/sms").catch(() => null);
    if (res?.ok) setItems((await res.json()).items);
  }
  return (
    <details
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
      className="border-t border-border pt-3 text-small"
    >
      <summary className="flex min-h-10 cursor-pointer items-center gap-2">
        {t("smsLog")} <SimulatedTag />
      </summary>
      {items?.length === 0 && <p className="text-text-secondary">{t("smsEmpty")}</p>}
      <ul className="flex flex-col gap-2">
        {items?.map((s) => (
          <li key={s.id} className="rounded-lg bg-muted p-2">
            <p className="text-caption text-text-secondary">{s.toPhone}</p>
            <p className="whitespace-pre-line">{s.body}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function DemoPanel({ status }: { status: DemoStatus }) {
  const t = useTranslations("demo");
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(status.locked);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [passcode, setPasscode] = useState("");
  const presenter = usePresenter();

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

  // Phones: the open panel sits under the top bar, and the closed handle is a tab on the right
  // edge, so neither covers header actions, the bottom nav or a sticky Apply bar (doc 04 §4).
  // Desktop: bottom-right; the shells leave room below the content for it.
  const position = "fixed top-16 right-2 z-40 md:top-auto md:right-4 md:bottom-4";

  const secondary = (
    <>
      <SmsLog />
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
  );

  if (!open) {
    return (
      <button
        type="button"
        aria-label={t("open")}
        onClick={() => setOpen(true)}
        className="fixed top-1/2 right-0 z-40 inline-flex h-11 w-9 -translate-y-1/2 items-center justify-center rounded-l-full bg-navy-700 text-white shadow-overlay hover:bg-navy-600 md:top-auto md:right-4 md:bottom-4 md:size-11 md:translate-y-0 md:rounded-full"
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
          <PresenterSwitch />
          <div className="flex flex-col gap-1 border-t border-border pt-3">
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
          {presenter ? (
            // Presenter mode hides the secondary tools until opened (doc 04 §8).
            <details className="border-t border-border pt-3" data-testid="more-tools">
              <summary className="flex min-h-10 cursor-pointer items-center text-small font-medium">
                {t("moreTools")}
              </summary>
              <div className="flex flex-col gap-3 pt-2">{secondary}</div>
            </details>
          ) : (
            secondary
          )}
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
