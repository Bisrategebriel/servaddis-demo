import { ArrowLeft, Clock, Megaphone, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { previewContext } from "@/components/employer/composer/composer-data";
import { JobPreview } from "@/components/employer/composer/job-preview";
import { JobActions } from "@/components/employer/job-actions";
import { JobStatusChip } from "@/components/employer/job-status-chip";
import { formatDate, formatDateTime, timeToFill } from "@/lib/format";
import { formFromJob } from "@/lib/job-form";
import { DAY_MS, now } from "@/server/clock";
import { Forbidden } from "@/components/employer/forbidden";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";
import type { Flag } from "@/server/rules/engine";
import { EXPIRY_WARNING_MS } from "@/server/sweep";

// SCR-E07 job overview: status, moderation feedback, expiry banner, timeline, close / repost and
// the bilingual preview. Applicants (T3.3) and promote (T5.2) join the actions later.

const NOTE_TONE = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_REVIEW: "bg-info-bg text-info-fg",
  CHANGES_REQUESTED: "bg-warning-bg text-warning-fg",
  LIVE: "bg-success-bg text-success-fg",
  EXPIRED: "bg-gray-100 text-gray-700",
  CLOSED: "bg-navy-50 text-navy-800",
  REJECTED: "bg-danger-bg text-danger-fg",
} as const;

async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }, locale, t] = await Promise.all([
    getEmployerContext(),
    params,
    getLocale(),
    getTranslations("jobs.overview"),
  ]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");

  const job = await db.job.findUnique({
    where: { id },
    include: {
      subCity: true,
      roleTemplate: true,
      moderation: { where: { type: "JOB" }, orderBy: { createdAt: "desc" }, take: 1 },
      repostOf: { select: { id: true } },
      _count: { select: { applications: true } },
      applications: { where: { status: "APPLIED", viewedAt: null }, select: { id: true } },
    },
  });
  // Another venue's job looks exactly like a missing one (doc 05 §5.3).
  if (!job || job.venueId !== ctx.membership.venueId) notFound();
  if (!ctx.membership.permissions.has("job.view"))
    return <Forbidden venueId={ctx.membership.venueId} />;

  const am = locale === "am";
  const latest = job.moderation[0];
  const reason =
    latest?.reason && (job.status === "CHANGES_REQUESTED" || job.status === "REJECTED")
      ? latest.reason
      : null;
  const notes =
    latest && job.status === "PENDING_REVIEW"
      ? (JSON.parse(latest.flags) as Flag[]).filter((f) => f.severity !== "block")
      : [];
  const editable = job.status === "DRAFT" || job.status === "CHANGES_REQUESTED";
  const title = (am ? job.titleAm || job.titleEn : job.titleEn || job.titleAm) || "—";

  // E-11: warn three days ahead, like the sweep's JOB_EXPIRING notification (normal posts only).
  const msLeft = job.expiresAt ? job.expiresAt.getTime() - now().getTime() : Infinity;
  const expiringSoon =
    job.status === "LIVE" && job.urgency === "NORMAL" && msLeft > 0 && msLeft <= EXPIRY_WARNING_MS;

  const timeline = [
    { label: t("created"), at: job.createdAt },
    { label: t("submittedAt"), at: job.submittedAt },
    { label: t("published"), at: job.publishedAt },
    {
      label: job.status === "EXPIRED" ? t("expiredAt") : t("expiresAt"),
      at: job.status === "CLOSED" ? null : job.expiresAt,
    },
    { label: job.filledAt ? t("filledAt") : t("closedAt"), at: job.filledAt ?? job.closedAt },
  ].filter((e) => e.at);
  // Time-to-fill (App Flow §5.1): filledAt − publishedAt.
  const ttf = job.filledAt && job.publishedAt ? timeToFill(job.publishedAt, job.filledAt) : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/employer/jobs"
        className="inline-flex min-h-10 w-fit items-center gap-1.5 text-small text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-h1 wrap-break-word">{title}</h1>
          <JobStatusChip status={job.status} />
          {ctx.membership.permissions.has("applicant.view") && job.publishedAt && (
            <Link
              href={`/employer/jobs/${job.id}/applicants`}
              className="inline-flex w-fit items-center gap-2 font-medium text-navy-700 underline underline-offset-4"
            >
              {t("applicantsLink", { count: job._count.applications })}
              {job.applications.length > 0 && (
                <span className="rounded-full bg-brand-accent px-2 py-0.5 text-caption font-semibold text-navy-900 no-underline">
                  {t("newCount", { count: job.applications.length })}
                </span>
              )}
            </Link>
          )}
          {job.repostOf && (
            <Link
              href={`/employer/jobs/${job.repostOf.id}`}
              className="w-fit text-small text-navy-700 underline underline-offset-4"
            >
              {t("repostOf")}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {job.status === "LIVE" && ctx.membership.permissions.has("social.promote") && (
            <Link
              href={`/employer/jobs/${job.id}/promote`}
              className="inline-flex h-11 items-center gap-2 rounded-sm border border-input bg-card px-4 font-medium hover:bg-muted"
            >
              <Megaphone className="size-4" aria-hidden />
              {t("promoteLink")}
            </Link>
          )}
          {ctx.membership.permissions.has("job.close") && (
            <JobActions jobId={job.id} status={job.status} />
          )}
        </div>
        {editable && ctx.membership.permissions.has("job.edit") && (
          <Link
            href={`/employer/jobs/${job.id}/edit`}
            className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-4 font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <Pencil className="size-4" aria-hidden />
            {job.status === "DRAFT" ? t("continueDraft") : t("edit")}
          </Link>
        )}
      </div>

      {expiringSoon && (
        <p
          data-testid="expiry-banner"
          className="flex items-start gap-2 rounded-md bg-warning-bg px-4 py-3 text-warning-fg"
        >
          <Clock className="mt-1 size-4 shrink-0" aria-hidden />
          {t("expiringSoon", {
            days: Math.max(1, Math.ceil(msLeft / DAY_MS)),
            date: formatDate(job.expiresAt!, locale),
          })}
        </p>
      )}

      <div className={`flex flex-col gap-2 rounded-md px-4 py-3 ${NOTE_TONE[job.status]}`}>
        <p data-testid="status-note">{job.filledAt ? t("filledNote") : t(`notes.${job.status}`)}</p>
        {job.status === "LIVE" && (
          <Link href={`/jobs/${job.id}`} className="w-fit text-small underline underline-offset-4">
            {t("viewInFeed")}
          </Link>
        )}
        {reason && (
          <p className="text-small">
            <span className="font-semibold">{t("reason")}:</span> {reason}
          </p>
        )}
        {notes.length > 0 && (
          <div className="text-small">
            <p className="font-semibold">{t("warnings")}</p>
            <ul className="list-disc ps-5">
              {notes.map((f, i) => (
                <li key={i}>{am ? f.messageAm : f.messageEn}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <section aria-labelledby="timeline" className="flex flex-col gap-4">
          <h2 id="timeline" className="text-h3">
            {t("timeline")}
          </h2>
          <dl className="flex flex-col gap-3">
            {timeline.map((e) => (
              <div key={e.label}>
                <dt className="text-small text-text-secondary">{e.label}</dt>
                <dd>{formatDateTime(e.at!, locale)}</dd>
              </div>
            ))}
            {ttf && (
              <div>
                <dt className="text-small text-text-secondary">{t("timeToFill")}</dt>
                <dd data-testid="time-to-fill" className="font-semibold">
                  {ttf.unit === "hours"
                    ? t("hours", { count: ttf.value })
                    : t("days", { count: ttf.value })}
                </dd>
              </div>
            )}
            {job.postingSource && (
              <div>
                <dt className="text-small text-text-secondary">{t("posting")}</dt>
                <dd>{t(`sources.${job.postingSource}`)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section aria-labelledby="preview" className="flex min-w-0 flex-col gap-2">
          <h2 id="preview" className="text-h3">
            {t("preview")}
          </h2>
          <JobPreview
            form={formFromJob(job, job.subCity.slug, job.roleTemplate?.slug ?? null)}
            {...await previewContext(job.venueId)}
          />
        </section>
      </div>
    </div>
  );
}

export default async function JobOverviewPage({
  params,
}: PageProps<"/[locale]/employer/jobs/[id]">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-text-secondary">{t("loading")}</p>}>
      <Overview params={params} />
    </Suspense>
  );
}
