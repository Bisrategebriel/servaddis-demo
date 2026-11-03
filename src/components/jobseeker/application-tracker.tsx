"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
import { EmptyState, emptyActionClass } from "@/components/empty-state";
import { cx } from "@/lib/cx";
import { formatDateTime } from "@/lib/format";
import type { MyApplication } from "@/server/services/applications";
import { pick } from "./job-text";

// SCR-J03 tracker. Polls every 5 s (TRD §7.2); the API answers 304 while nothing changed.

const fetcher = async (url: string): Promise<{ items: MyApplication[] }> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

type Step = { key: "APPLIED" | "VIEWED" | "SHORTLISTED" | "HIRED" | "REJECTED"; at: string | null };

/** doc 04 StepTracker: Applied → Viewed → Shortlisted → Hired, or ending in Rejected. */
export function StepTracker({ app }: { app: MyApplication }) {
  const t = useTranslations("tracker");
  const locale = useLocale();
  const rejected = app.status === "REJECTED";
  const steps: Step[] = [
    { key: "APPLIED", at: app.appliedAt },
    { key: "VIEWED", at: app.viewedAt },
    { key: "SHORTLISTED", at: app.shortlistedAt },
    rejected ? { key: "REJECTED", at: app.rejectedAt } : { key: "HIRED", at: app.hiredAt },
  ];
  return (
    <ol aria-label={t("progress")} className="grid grid-cols-4 gap-1">
      {steps.map((s, i) => {
        const done = !!s.at;
        const current = s.key === app.status;
        const bad = s.key === "REJECTED";
        return (
          <li
            key={s.key}
            aria-current={current ? "step" : undefined}
            className="flex flex-col items-center gap-1 text-center"
          >
            <span className="flex w-full items-center">
              <span
                className={cx(
                  "h-0.5 flex-1",
                  i === 0 ? "invisible" : done ? "bg-success" : "bg-gray-200",
                )}
              />
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  bad
                    ? "bg-danger-solid text-white"
                    : done
                      ? "bg-success text-white"
                      : "border-2 border-gray-300 bg-card",
                  current && !bad && "ring-2 ring-success/30",
                )}
              >
                {bad ? (
                  <X className="size-3.5" aria-hidden />
                ) : (
                  done && <Check className="size-3.5" aria-hidden />
                )}
              </span>
              <span
                className={cx(
                  "h-0.5 flex-1",
                  i === steps.length - 1
                    ? "invisible"
                    : steps[i + 1].at
                      ? "bg-success"
                      : "bg-gray-200",
                )}
              />
            </span>
            <span
              className={cx(
                "text-caption",
                current ? "font-semibold" : done ? "" : "text-text-secondary",
              )}
            >
              {t(`steps.${s.key}`)}
            </span>
            {s.at && (
              <span className="text-caption text-text-secondary">
                {formatDateTime(s.at, locale)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ApplicationTracker({ initial }: { initial: MyApplication[] }) {
  const t = useTranslations("tracker");
  const lang = useLocale() === "am" ? "am" : "en";
  const { data } = useSWR("/api/me/applications", fetcher, {
    refreshInterval: 5000,
    fallbackData: { items: initial },
    revalidateOnMount: false,
  });
  const items = data?.items ?? initial;

  if (items.length === 0) {
    return (
      <EmptyState
        illustration="jobs"
        title={t("empty")}
        action={
          <Link href="/jobs" className={emptyActionClass}>
            {t("browse")}
          </Link>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="applications">
      {items.map((app) => {
        const title = pick(lang, app.job.titleEn, app.job.titleAm);
        const final = app.status === "HIRED" || app.status === "REJECTED";
        return (
          <li
            key={app.id}
            data-status={app.status}
            className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
          >
            <div>
              <Link href={`/jobs/${app.job.id}`} className="text-h3 hover:underline">
                {title.text}
              </Link>
              <p className="text-small text-text-secondary">
                {(lang === "am" ? app.job.venueAm : null) || app.job.venueEn}
              </p>
            </div>
            <StepTracker app={app} />
            <p className="text-small">{t(`hint.${app.status}`)}</p>
            {!final && !app.job.open && (
              <p className="text-small text-text-secondary">{t("closed")}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
