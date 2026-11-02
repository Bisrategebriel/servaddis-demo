"use client";

import type { Channel, DistributionStatus } from "@prisma/client";
import { Download, Megaphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SimulatedTag } from "@/components/simulated-tag";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DistributionLog } from "@/server/services/promote";

// SCR-E10 Promote: card preview (language + size), one button, then the publish log with a
// preview of each channel's post. Polls every 2 s until every channel has settled (TRD §7.2).
// Every row carries the Simulated tag (doc 04 §6.1): nothing is really posted in the demo.

const POLL_MS = 2000;

const STATUS_TONE: Record<DistributionStatus, string> = {
  QUEUED: "bg-gray-100 text-gray-700",
  RENDERED: "bg-info-bg text-info-fg",
  PUBLISHED: "bg-success-bg text-success-fg",
  DRAFT_FOR_TEAM: "bg-warning-bg text-warning-fg",
  FAILED: "bg-danger-bg text-danger-fg",
};

function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-10 rounded-sm px-3 text-small font-medium",
            value === o.value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A mock of how the post looks on each channel. */
function ChannelPreview({
  channel,
  caption,
  cardUrl,
  storyUrl,
}: {
  channel: Channel;
  caption: string;
  cardUrl: string;
  storyUrl: string;
}) {
  const t = useTranslations("promote");
  if (channel === "TIKTOK") {
    return (
      <div className="flex flex-col items-start gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
        <img src={storyUrl} alt="" className="w-40 rounded-md border border-border" />
        <p className="text-small text-warning-fg">{t("tiktokNote")}</p>
      </div>
    );
  }
  return (
    <div className="flex max-w-sm flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 text-small font-semibold">
        <span className="flex size-7 items-center justify-center rounded-full bg-navy-900 text-caption text-amber-400">
          S
        </span>
        Servaddis Jobs
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
      <img src={cardUrl} alt="" className="w-full" />
      <p className="px-3 py-2 text-small whitespace-pre-line">{caption}</p>
      {channel === "TELEGRAM" && (
        <span className="m-3 mt-0 rounded-sm bg-info-bg py-2 text-center text-small font-semibold text-info-fg">
          {t("applyButton")}
        </span>
      )}
    </div>
  );
}

export function PromotePanel({
  jobId,
  initial,
  canPromote,
}: {
  jobId: string;
  initial: DistributionLog;
  canPromote: boolean;
}) {
  const t = useTranslations("promote");
  const pageAm = useLocale() === "am";
  const [log, setLog] = useState(initial);
  const [lang, setLang] = useState<"am" | "en">(pageAm ? "am" : "en");
  const [size, setSize] = useState<"square" | "story">("square");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Channel | null>(null);

  const cardUrl = (l: string, s: string) => `/api/jobs/${jobId}/card?lang=${l}&size=${s}`;
  const promoted = log.posts.length > 0;

  // Poll while any channel is still on its way.
  useEffect(() => {
    if (!promoted || log.settled) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/distribution`);
        if (res.ok) setLog(await res.json());
      } catch {
        // next tick retries
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [jobId, log, promoted]);

  async function promote() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/promote`, { method: "POST" });
      const body = await res.json();
      if (res.ok) setLog(body);
      else setError(pageAm ? body.error.messageAm : body.error.message);
    } catch {
      setError(t("failed"));
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section aria-labelledby="card" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="card" className="text-h3">
            {t("card")}
          </h2>
          <Toggle
            label={t("card")}
            value={size}
            onChange={setSize}
            options={[
              { value: "square", label: t("square") },
              { value: "story", label: t("story") },
            ]}
          />
        </div>
        <Toggle
          label={t("caption")}
          value={lang}
          onChange={setLang}
          options={[
            { value: "am", label: "አማ" },
            { value: "en", label: "EN" },
          ]}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG */}
        <img
          src={cardUrl(lang, size)}
          alt=""
          data-testid="card-preview"
          className={cn("rounded-md border border-border", size === "story" ? "w-56" : "w-full")}
        />
        <a
          href={`${cardUrl(lang, size)}&download=1`}
          className="inline-flex h-11 w-fit items-center gap-2 rounded-sm border border-input bg-card px-4 font-medium"
        >
          <Download className="size-4" aria-hidden />
          {t("download")}
        </a>
      </section>

      <section aria-labelledby="channels" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="channels" className="text-h3">
            {t("channels")}
          </h2>
          {canPromote && !promoted && (
            <Button className="h-11 px-4" disabled={busy} onClick={promote}>
              <Megaphone className="size-4" aria-hidden />
              {busy ? t("promoting") : t("promote")}
            </Button>
          )}
          {promoted && (
            <span className="rounded-sm bg-success-bg px-2 py-1 text-small font-medium text-success-fg">
              {t("promoted")}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
            {error}
          </p>
        )}
        <p className="text-small text-text-secondary">{t("simulatedNote")}</p>
        {promoted && (
          <ul
            className="flex flex-col divide-y divide-border rounded-md border border-border bg-card"
            data-testid="publish-log"
          >
            {log.posts.map((p) => (
              <li
                key={p.channel}
                data-channel={p.channel}
                data-status={p.status}
                className="flex flex-col gap-3 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-24 font-semibold">{t(`channelNames.${p.channel}`)}</span>
                  <span
                    className={cn("rounded-sm px-2 py-0.5 text-caption", STATUS_TONE[p.status])}
                  >
                    {t(`status.${p.status}`)}
                  </span>
                  {p.simulated && <SimulatedTag />}
                  <button
                    type="button"
                    aria-expanded={open === p.channel}
                    onClick={() => setOpen(open === p.channel ? null : p.channel)}
                    className="ml-auto min-h-10 text-small text-navy-700 underline underline-offset-4"
                  >
                    {open === p.channel ? t("hidePreview") : t("preview")}
                  </button>
                </div>
                {open === p.channel && (
                  <ChannelPreview
                    channel={p.channel}
                    caption={lang === "am" ? p.captionAm : p.captionEn}
                    cardUrl={cardUrl(lang, "square")}
                    storyUrl={cardUrl(lang, "story")}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
