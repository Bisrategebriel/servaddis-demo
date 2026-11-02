import type { Job, JobStatus } from "@prisma/client";
import { Clock, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { JobStatusChip } from "@/components/employer/job-status-chip";
import { formatDate, formatSalary } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Forbidden } from "@/components/employer/forbidden";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";

// SCR-E04: every job of the venue with its status chip. Applicant counts are shown to every
// member with job.view, a Poster included (doc 03 §1.2); names stay behind applicant.view.

const STATUSES: JobStatus[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "LIVE",
  "EXPIRED",
  "CLOSED",
  "REJECTED",
];

/** The date that matters for each status. */
function dateLine(job: Job): {
  key: "submitted" | "expires" | "expired" | "closed" | "edited";
  at: Date;
} {
  switch (job.status) {
    case "PENDING_REVIEW":
      return { key: "submitted", at: job.submittedAt ?? job.updatedAt };
    case "LIVE":
      return job.expiresAt
        ? { key: "expires", at: job.expiresAt }
        : { key: "edited", at: job.updatedAt };
    case "EXPIRED":
      return { key: "expired", at: job.expiresAt ?? job.updatedAt };
    case "CLOSED":
      return { key: "closed", at: job.closedAt ?? job.updatedAt };
    default:
      return { key: "edited", at: job.updatedAt };
  }
}

async function JobsList({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [ctx, { status: rawStatus }, locale, t, tp, ts] = await Promise.all([
    getEmployerContext(),
    searchParams,
    getLocale(),
    getTranslations("jobs.list"),
    getTranslations("jobs.preview"),
    getTranslations("jobs.status"),
  ]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("job.view"))
    return <Forbidden venueId={ctx.membership.venueId} />;
  const am = locale === "am";
  const status = STATUSES.find((s) => s === rawStatus);

  const all = await db.job.findMany({
    where: { venueId: ctx.membership.venueId },
    orderBy: { createdAt: "desc" },
    include: {
      subCity: true,
      _count: { select: { applications: true } },
      // "new" = not opened by anyone yet (E-19 unread badge on the job)
      applications: { where: { status: "APPLIED", viewedAt: null }, select: { id: true } },
    },
  });
  const jobs = status ? all.filter((j) => j.status === status) : all;
  const counts = new Map<JobStatus, number>();
  for (const j of all) counts.set(j.status, (counts.get(j.status) ?? 0) + 1);

  const filter = (value: JobStatus | undefined, label: string, count: number) => (
    <Link
      key={value ?? "all"}
      href={value ? `/employer/jobs?status=${value}` : "/employer/jobs"}
      aria-current={status === value ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-sm px-3 text-small",
        status === value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
      )}
    >
      {label} ({count})
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">{t("title")}</h1>
        {ctx.membership.permissions.has("job.create") && (
          <Link
            href="/employer/jobs/new"
            className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-4 font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden />
            {t("post")}
          </Link>
        )}
      </div>

      {all.length > 0 && (
        <nav aria-label={t("filters")} className="flex flex-wrap gap-2">
          {filter(undefined, t("all"), all.length)}
          {STATUSES.filter((s) => counts.has(s)).map((s) => filter(s, ts(s), counts.get(s)!))}
        </nav>
      )}

      {jobs.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong bg-card p-6 text-text-secondary">
          {all.length === 0 ? t("empty") : t("emptyFiltered")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="jobs-list">
          {jobs.map((job) => {
            const title =
              (am ? job.titleAm || job.titleEn : job.titleEn || job.titleAm) || t("untitled");
            const { key, at } = dateLine(job);
            return (
              <li key={job.id}>
                <Link
                  href={`/employer/jobs/${job.id}`}
                  className="flex flex-col gap-2 rounded-md border border-border bg-card p-4 hover:border-border-strong sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold wrap-break-word">{title}</span>
                      {job.urgency !== "NORMAL" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-accent px-2 py-0.5 text-caption text-navy-900">
                          <Clock className="size-3" aria-hidden />
                          {t("urgent")}
                        </span>
                      )}
                    </div>
                    <p className="text-small text-text-secondary">
                      {[
                        am ? job.subCity.nameAm : job.subCity.nameEn,
                        job.salaryMin > 0 &&
                          `${formatSalary(job.salaryMin, job.salaryMax)} / ${tp(`period.${job.salaryPeriod}`)}`,
                        t(key, { date: formatDate(at, locale) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-small text-text-secondary">
                      {t("applicants", { count: job._count.applications })}
                    </span>
                    {job.applications.length > 0 && (
                      <span
                        data-testid="new-badge"
                        className="rounded-full bg-brand-accent px-2 py-0.5 text-caption font-semibold text-navy-900"
                      >
                        {t("newCount", { count: job.applications.length })}
                      </span>
                    )}
                    <JobStatusChip status={job.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default async function JobsPage({ searchParams }: PageProps<"/[locale]/employer/jobs">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-text-secondary">{t("loading")}</p>}>
      <JobsList searchParams={searchParams as Promise<{ status?: string }>} />
    </Suspense>
  );
}
