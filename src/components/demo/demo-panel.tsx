"use client";

import {
  CheckCheck,
  Clock,
  FastForward,
  Presentation,
  RotateCcw,
  Smartphone,
  Tag,
  UserPlus,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  PERSONAS,
  SCENARIOS,
  SKIP_DAYS,
  type DemoStatus,
  type PersonaKey,
  type Scenario,
} from "@/lib/demo";
import type { DisplayPref } from "@/lib/display-prefs";
import { setDisplayPref, useDisplayPref } from "@/lib/display-prefs-client";
import { formatDateTime } from "@/lib/format";
import { PhoneDrawer } from "./phone-drawer";

// The Demo Toolkit panel (TRD §5.10, App Flow §9, doc 04 §8). Loaded lazily by the dock, so none
// of this counts against the jobseeker bundle budget.

const post = (path: string, body?: unknown) =>
  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// A full load, not client navigation: the language, and with it the root layout, may change.
const goTo = (path: string) => window.location.replace(new URL(path, window.location.origin).href);

/** The job on screen, if any: simulated applicants go there rather than to the newest job. */
function jobOnScreen() {
  const m = window.location.pathname.match(/\/employer\/jobs\/([^/]+)/);
  return m && m[1] !== "new" ? m[1] : undefined;
}

type ErrorBody = { error?: { message: string; messageAm: string } };
type Notice = { tone: "ok" | "error"; text: string };

/** On/off row for a display setting (presenter mode, Simulated tags). */
function PrefSwitch({
  pref,
  invert = false,
  icon: Icon,
  label,
  hint,
  testId,
}: {
  pref: DisplayPref;
  /** The switch shows the opposite of the stored flag ("show tags" ↔ hideSimulated). */
  invert?: boolean;
  icon: LucideIcon;
  label: string;
  hint: string;
  testId: string;
}) {
  const stored = useDisplayPref(pref);
  const on = invert ? !stored : stored;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-testid={testId}
      onClick={() => setDisplayPref(pref, invert ? on : !on)}
      className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-left hover:bg-accent"
    >
      <Icon className="size-5 shrink-0 text-text-secondary" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-small font-medium">{label}</span>
        <span className="text-caption text-text-secondary">{hint}</span>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-3">
      <h3 className="text-caption text-text-secondary">{title}</h3>
      {children}
    </section>
  );
}

const toolClass =
  "inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-small hover:bg-accent disabled:opacity-50";

export default function DemoPanel({ status }: { status: DemoStatus }) {
  const t = useTranslations("demo");
  const locale = useLocale();
  const router = useRouter();
  const presenter = useDisplayPref("presenter");
  const [open, setOpen] = useState(false);
  const [locked, setLocked] = useState(status.locked);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("venue-verified");
  const [clock, setClock] = useState({ now: status.now, offsetDays: status.offsetDays });

  async function run(
    key: string,
    action: () => Promise<Response>,
    then: (res: Response) => Promise<void>,
  ) {
    setBusy(key);
    setNotice(null);
    const res = await action().catch(() => null);
    if (res?.ok) await then(res);
    else {
      const e = ((await res?.json().catch(() => null)) as ErrorBody | null)?.error;
      setNotice({
        tone: "error",
        text: e ? (locale === "am" ? e.messageAm : e.message) : t("failed"),
      });
    }
    setBusy(null);
  }

  const followRedirect = async (res: Response) => goTo((await res.json()).redirectTo);
  const switchTo = (persona: PersonaKey) =>
    run(`persona-${persona}`, () => post("/api/demo/persona", { persona }), followRedirect);
  const reset = () => run("reset", () => post("/api/demo/reset"), followRedirect);

  const simulate = () =>
    run(
      "simulate",
      () => post("/api/demo/simulate-applicant", { jobId: jobOnScreen() }),
      async (res) => {
        const r = await res.json();
        setNotice({
          tone: "ok",
          text: t("simulatedApplicant", {
            name: r.name,
            job: locale === "am" ? r.titleAm : r.titleEn,
          }),
        });
      },
    );

  const approveAll = () =>
    run(
      "approve",
      () => post("/api/demo/approve-all"),
      async (res) => {
        setNotice({ tone: "ok", text: t("approved", await res.json()) });
        router.refresh();
      },
    );

  const skip = (days: number) =>
    run(
      `skip-${days}`,
      () => post("/api/demo/time-skip", { days }),
      async (res) => {
        const r = await res.json();
        setClock((c) => ({ now: r.now, offsetDays: c.offsetDays + days }));
        setNotice({
          tone: "ok",
          text: t("skipped", {
            date: formatDateTime(r.now, locale),
            expired: r.expired,
            checkins: r.checkinsSent,
          }),
        });
        router.refresh();
      },
    );

  const jump = (e: FormEvent) => {
    e.preventDefault();
    void run("scenario", () => post("/api/demo/scenario", { name: scenario }), followRedirect);
  };

  function unlock(e: FormEvent) {
    e.preventDefault();
    void run(
      "unlock",
      () => post("/api/demo/unlock", { passcode }),
      async () => setLocked(false),
    );
  }

  // Phones: the open panel sits under the top bar, and the closed handle is a tab on the right
  // edge, so neither covers header actions, the bottom nav or a sticky Apply bar (doc 04 §4).
  // Desktop: bottom-right; the shells leave room below the content for it.
  const position = "fixed top-16 right-2 z-40 md:top-auto md:right-4 md:bottom-4";

  if (!open) {
    return (
      <>
        <button
          type="button"
          aria-label={t("open")}
          onClick={() => setOpen(true)}
          className="fixed top-1/2 right-0 z-40 inline-flex h-11 w-9 -translate-y-1/2 items-center justify-center rounded-l-full bg-navy-700 text-white shadow-overlay hover:bg-navy-600 md:top-auto md:right-4 md:bottom-4 md:size-11 md:translate-y-0 md:rounded-full"
        >
          <Wrench className="size-5" aria-hidden />
        </button>
        <PhoneDrawer open={phoneOpen} onOpenChange={setPhoneOpen} />
      </>
    );
  }

  const fallbacks = (
    <Section title={t("fallbacks")}>
      <button type="button" disabled={!!busy} onClick={simulate} className={toolClass}>
        <UserPlus className="size-4 text-text-secondary" aria-hidden />
        {t("simulateApplicant")}
      </button>
      <button type="button" disabled={!!busy} onClick={approveAll} className={toolClass}>
        <CheckCheck className="size-4 text-text-secondary" aria-hidden />
        {t("approveAll")}
      </button>
      <label htmlFor="toolkit-scenario" className="px-1 pt-1 text-caption text-text-secondary">
        {t("scenario")}
      </label>
      <form onSubmit={jump} className="flex gap-2 px-1">
        <select
          id="toolkit-scenario"
          value={scenario}
          onChange={(e) => setScenario(e.target.value as Scenario)}
          className="h-10 min-w-0 flex-1 rounded-sm border border-input bg-card px-2 text-small"
        >
          {SCENARIOS.map((s) => (
            <option key={s} value={s}>
              {t(`scenarios.${s}`)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={!!busy} className="h-10">
          <FastForward aria-hidden />
          {t("scenarioGo")}
        </Button>
      </form>
    </Section>
  );

  // Secondary tools: folded under "More tools" in presenter mode (doc 04 §8).
  const secondary = (
    <>
      <Section title={t("time")}>
        <p className="flex items-center gap-2 px-1 text-small" data-testid="demo-date">
          <Clock className="size-4 text-text-secondary" aria-hidden />
          {t("demoDate", { date: formatDateTime(clock.now, locale) })}
        </p>
        {clock.offsetDays > 0 && (
          <p className="px-1 text-caption text-text-secondary">
            {t("ahead", { days: clock.offsetDays })}
          </p>
        )}
        <div className="grid grid-cols-4 gap-1">
          {SKIP_DAYS.map((d) => (
            <Button
              key={d}
              variant="outline"
              disabled={!!busy}
              className="h-10 px-1"
              aria-label={t("skipLabel", { days: d })}
              onClick={() => skip(d)}
            >
              {t("skip", { days: d })}
            </Button>
          ))}
        </div>
      </Section>
      <section className="flex flex-col gap-1 border-t border-border pt-3">
        <button type="button" onClick={() => setPhoneOpen(true)} className={toolClass}>
          <Smartphone className="size-4 text-text-secondary" aria-hidden />
          {t("phone")}
        </button>
        <PrefSwitch
          pref="hideSimulated"
          invert
          icon={Tag}
          label={t("showTags")}
          hint={t("showTagsHint")}
          testId="tags-switch"
        />
      </section>
      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <Button
          variant={confirming ? "destructive" : "outline"}
          disabled={!!busy}
          className="h-10"
          onClick={() => (confirming ? reset() : setConfirming(true))}
        >
          <RotateCcw aria-hidden />
          {busy === "reset" ? t("resetting") : confirming ? t("resetConfirm") : t("reset")}
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

  return (
    <>
      <aside
        aria-label={t("title")}
        data-testid="demo-panel"
        className={`${position} flex max-h-[calc(100vh-5rem)] w-76 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-overlay`}
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
            <Button type="submit" disabled={!!busy || !passcode} className="h-11">
              {t("unlock")}
            </Button>
          </form>
        ) : (
          <>
            <PrefSwitch
              pref="presenter"
              icon={Presentation}
              label={t("presenter")}
              hint={t("presenterHint")}
              testId="presenter-switch"
            />
            {notice && (
              <p
                role={notice.tone === "error" ? "alert" : "status"}
                data-testid="toolkit-notice"
                className={`rounded-sm px-3 py-2 text-small ${notice.tone === "error" ? "bg-danger-bg text-danger-fg" : "bg-success-bg text-success-fg"}`}
              >
                {notice.text}
              </p>
            )}
            <Section title={t("personas")}>
              {PERSONAS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  disabled={!!busy}
                  onClick={() => switchTo(p.key)}
                  className="min-h-10 rounded-lg px-3 py-1.5 text-left text-small hover:bg-accent disabled:opacity-50"
                >
                  {t(`persona.${p.key}`)}
                </button>
              ))}
            </Section>
            {fallbacks}
            {presenter ? (
              <details className="border-t border-border pt-3" data-testid="more-tools">
                <summary className="flex min-h-10 cursor-pointer items-center text-small font-medium">
                  {t("moreTools")}
                </summary>
                <div className="flex flex-col gap-3">{secondary}</div>
              </details>
            ) : (
              secondary
            )}
          </>
        )}
        {locked && notice && (
          <p role="alert" className="text-small text-danger-fg">
            {notice.text}
          </p>
        )}
      </aside>
      <PhoneDrawer open={phoneOpen} onOpenChange={setPhoneOpen} />
    </>
  );
}
