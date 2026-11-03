import { ArrowLeft } from "lucide-react";
import { PipelineSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/employer/forbidden";
import { JobStatusChip } from "@/components/employer/job-status-chip";
import { Pipeline } from "@/components/employer/pipeline";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";
import { listApplicants } from "@/server/services/pipeline";

// SCR-E08. Members without applicant.view (a Poster) get the 403 page instead (doc 03 §11).

async function Applicants({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }, locale, t] = await Promise.all([
    getEmployerContext(),
    params,
    getLocale(),
    getTranslations("pipeline"),
  ]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  const job = await db.job.findUnique({ where: { id } });
  // Another venue's job looks exactly like a missing one (doc 05 §5.3).
  if (!job || job.venueId !== ctx.membership.venueId) notFound();

  const back = (
    <Link
      href={`/employer/jobs/${job.id}`}
      className="inline-flex min-h-10 w-fit items-center gap-1.5 text-small text-text-secondary hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t("back")}
    </Link>
  );

  if (!ctx.membership.permissions.has("applicant.view")) {
    return <Forbidden venueId={ctx.membership.venueId} />;
  }

  const title = (locale === "am" ? job.titleAm || job.titleEn : job.titleEn || job.titleAm) || "—";
  return (
    <div className="flex flex-col gap-4">
      {back}
      <div className="flex flex-col gap-2">
        <p className="text-small text-text-secondary">{t("title")}</p>
        <h1 className="text-h1 wrap-break-word">{title}</h1>
        <JobStatusChip status={job.status} />
      </div>
      <Pipeline
        jobId={job.id}
        initial={await listApplicants(job.id, { sort: "completeness" })}
        permissions={[...ctx.membership.permissions]}
      />
    </div>
  );
}

export default async function ApplicantsPage({
  params,
}: PageProps<"/[locale]/employer/jobs/[id]/applicants">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<PipelineSkeleton label={t("loading")} />}>
      <Applicants params={params} />
    </Suspense>
  );
}
