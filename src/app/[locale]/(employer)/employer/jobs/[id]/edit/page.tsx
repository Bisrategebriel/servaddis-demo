import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { composerContext } from "@/components/employer/composer/composer-data";
import { JobComposer } from "@/components/employer/composer/job-composer";
import type { JobForm } from "@/lib/job-form";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";

const list = (json: string) => (JSON.parse(json) as string[]).join("\n");

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }] = await Promise.all([getEmployerContext(), params]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");

  const job = await db.job.findUnique({
    where: { id },
    include: { subCity: true, roleTemplate: true },
  });
  // Another venue's job looks exactly like a missing one (doc 05 §5.3).
  if (!job || job.venueId !== ctx.membership.venueId) notFound();
  if (!ctx.membership.permissions.has("job.edit")) redirect("/employer");
  if (job.status !== "DRAFT" && job.status !== "CHANGES_REQUESTED") redirect("/employer/jobs");

  const initial: JobForm = {
    roleTemplateSlug: job.roleTemplate?.slug ?? null,
    titleEn: job.titleEn,
    titleAm: job.titleAm ?? "",
    descriptionEn: job.descriptionEn,
    descriptionAm: job.descriptionAm ?? "",
    requirementsEn: list(job.requirementsEn),
    requirementsAm: list(job.requirementsAm),
    benefitsEn: list(job.benefitsEn),
    benefitsAm: list(job.benefitsAm),
    shiftPattern: job.shiftPattern ?? "",
    subCity: job.subCity.slug,
    headcount: String(job.headcount),
    salaryMin: job.salaryMin ? String(job.salaryMin) : "",
    salaryMax: job.salaryMax ? String(job.salaryMax) : "",
    salaryPeriod: job.salaryPeriod,
    employmentType: job.employmentType,
    urgency: job.urgency,
  };
  return (
    <JobComposer
      jobId={job.id}
      initial={initial}
      {...await composerContext(job.venueId, job.roleTemplate?.defaults ?? null)}
    />
  );
}

export default async function EditJobPage({
  params,
}: PageProps<"/[locale]/employer/jobs/[id]/edit">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-text-secondary">{t("loading")}</p>}>
      <Edit params={params} />
    </Suspense>
  );
}
