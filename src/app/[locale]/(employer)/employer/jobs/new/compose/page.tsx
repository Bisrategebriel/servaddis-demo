import { redirect } from "next/navigation";
import { FormSkeleton } from "@/components/skeletons";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { composerContext } from "@/components/employer/composer/composer-data";
import { JobComposer } from "@/components/employer/composer/job-composer";
import { emptyJobForm, formFromTemplate } from "@/lib/job-form";
import { prefillFromTemplate } from "@/lib/role-template";
import { Forbidden } from "@/components/employer/forbidden";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";

async function Compose({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const [ctx, { template: slug }] = await Promise.all([getEmployerContext(), searchParams]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  if (!ctx.membership.permissions.has("job.create"))
    return <Forbidden venueId={ctx.membership.venueId} />;

  const { venueId } = ctx.membership;
  const [venue, template] = await Promise.all([
    db.venue.findUniqueOrThrow({ where: { id: venueId }, include: { subCity: true } }),
    typeof slug === "string" ? db.roleTemplate.findUnique({ where: { slug } }) : null,
  ]);
  const subCity = venue.subCity.slug;
  const initial = template
    ? formFromTemplate(prefillFromTemplate(template), subCity)
    : emptyJobForm(subCity);
  return (
    <JobComposer
      jobId={null}
      initial={initial}
      {...await composerContext(ctx.membership, template?.defaults ?? null, null)}
    />
  );
}

export default async function ComposePage({
  searchParams,
}: PageProps<"/[locale]/employer/jobs/new/compose">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<FormSkeleton label={t("loading")} fields={5} />}>
      <Compose searchParams={searchParams as Promise<{ template?: string }>} />
    </Suspense>
  );
}
