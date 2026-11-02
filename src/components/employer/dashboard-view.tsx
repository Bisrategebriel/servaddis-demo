"use client";

import { Check, Circle, Clock, Hourglass, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VenueSummary } from "@/server/services/dashboard";

// SCR-E03. Polls every 4 s so the Verified badge appears by itself after approval (≤ 5 s, T1.5).

const fetcher = async (url: string): Promise<VenueSummary> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

type Verification = VenueSummary["venue"]["verification"];

const CHIP: Record<Verification, { icon: typeof Clock; tone: string }> = {
  UNSUBMITTED: { icon: Circle, tone: "bg-gray-100 text-gray-700" },
  PENDING: { icon: Hourglass, tone: "bg-info-bg text-info-fg" },
  VERIFIED: { icon: ShieldCheck, tone: "bg-success-bg text-success-fg" },
  REJECTED: { icon: ShieldAlert, tone: "bg-danger-bg text-danger-fg" },
};

function VerificationChip({ status }: { status: Verification }) {
  const t = useTranslations("dashboard");
  const { icon: Icon, tone } = CHIP[status];
  return (
    <span
      data-testid="verification"
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-sm px-2 py-1 text-caption",
        tone,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {t(`verification.${status}`)}
    </span>
  );
}

function Step({
  state,
  title,
  hint,
  children,
}: {
  state: "done" | "current" | "locked";
  title: string;
  hint?: string | null;
  children?: ReactNode;
}) {
  const Icon = state === "done" ? Check : state === "locked" ? Lock : Circle;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          state === "done" ? "bg-success text-white" : "bg-gray-100 text-gray-700",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn(state === "done" ? "text-text-secondary" : "font-semibold")}>{title}</p>
        {hint && <p className="text-small text-text-secondary">{hint}</p>}
      </div>
      {children}
    </li>
  );
}

/** What the viewer may act on: the checklist only offers buttons that will work for them. */
type Can = { createJob: boolean; editVenue: boolean };

function Checklist({ data, can }: { data: VenueSummary; can: Can }) {
  const t = useTranslations("dashboard");
  const { verification } = data.venue;
  const licenseDone = verification === "PENDING" || verification === "VERIFIED";
  const { rejectionReason, firstJob } = data.checklist;
  const done = 2 + (licenseDone ? 1 : 0) + (firstJob ? 1 : 0);
  if (data.checklist.hidden || done === 4) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 lg:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h2">{t("getStarted")}</h2>
        <span data-testid="checklist-progress" className="text-small text-text-secondary">
          {t("progress", { done, total: 4 })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t("getStarted")}
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={4}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${(done / 4) * 100}%` }} />
      </div>
      <ol className="flex flex-col gap-3">
        <Step state="done" title={t("stepRegister")} />
        <Step state="done" title={t("stepVenue")} />
        <Step
          state={licenseDone ? "done" : "current"}
          title={t("stepLicense")}
          hint={
            verification === "PENDING"
              ? t("verification.PENDING")
              : verification === "REJECTED"
                ? (rejectionReason ?? t("verification.REJECTED"))
                : null
          }
        >
          {!licenseDone && can.editVenue && (
            <Button asChild variant="outline" className="h-10">
              <Link href="/employer/onboarding/license">{t("uploadLicense")}</Link>
            </Button>
          )}
        </Step>
        <Step
          state={verification === "VERIFIED" ? "current" : "locked"}
          title={t("stepFirstJob")}
          hint={verification === "VERIFIED" ? null : t("firstJobLocked")}
        >
          {verification === "VERIFIED" && can.createJob && (
            <Button asChild className="h-10">
              <Link href="/employer/jobs/new">{t("postFirstJob")}</Link>
            </Button>
          )}
        </Step>
      </ol>
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-small text-text-secondary">{label}</p>
      <p className="text-h1 tabular-nums">{value}</p>
    </div>
  );
}

export function DashboardView({ venueId, name, can }: { venueId: string; name: string; can: Can }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const am = useLocale() === "am";
  const { data, error } = useSWR(`/api/venues/${venueId}/summary`, fetcher, {
    refreshInterval: 4000,
    keepPreviousData: true,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">{name ? t("welcome", { name }) : t("welcomeBack")}</h1>
        {data && <VerificationChip status={data.venue.verification} />}
      </div>

      {error && !data && (
        <p role="alert" className="text-small text-danger-fg">
          {t("loadFailed")}
        </p>
      )}
      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {data && (
        <>
          <Checklist data={data} can={can} />
          {data.expiringSoon.length > 0 && (
            <section
              data-testid="expiring-banner"
              className="flex flex-col gap-1 rounded-2xl bg-warning-bg px-4 py-3 text-warning-fg"
            >
              <h2 className="font-semibold">
                {t("expiringSoon", { count: data.expiringSoon.length })}
              </h2>
              <ul className="flex flex-col gap-1">
                {data.expiringSoon.map((j) => (
                  <li key={j.id}>
                    <Link href={`/employer/jobs/${j.id}`} className="underline underline-offset-4">
                      {(am ? j.titleAm : j.titleEn) || j.titleEn || j.titleAm}
                    </Link>{" "}
                    · {formatDate(j.expiresAt, am ? "am" : "en")}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label={t("liveJobs")} value={data.kpis.liveJobs} />
            <Kpi label={t("newApplicants")} value={data.kpis.newApplicants} />
            <Kpi
              label={t("timeToFill")}
              value={
                data.kpis.avgDaysToFill === null
                  ? "—"
                  : t("days", { days: data.kpis.avgDaysToFill })
              }
            />
            <Kpi
              label={t("plan")}
              value={
                data.kpis.plan
                  ? am
                    ? data.kpis.plan.nameAm
                    : data.kpis.plan.nameEn
                  : t("founding", { left: data.kpis.foundingPostsLeft })
              }
            />
          </div>
          <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 lg:p-6">
            <h2 className="text-h2">{t("recentActivity")}</h2>
            {data.activity.length ? (
              <ul className="flex flex-col gap-2">
                {data.activity.map((a) => (
                  <li key={a.id} className="text-small">
                    {t("applied", { name: a.name, job: (am && a.jobAm) || a.jobEn })}{" "}
                    <span className="text-text-secondary">
                      · {format.relativeTime(new Date(a.at), new Date(data.now))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-text-secondary">{t("noActivity")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
