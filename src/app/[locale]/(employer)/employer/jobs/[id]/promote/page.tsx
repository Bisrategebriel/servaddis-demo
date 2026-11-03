import { ArrowLeft, Lock } from "lucide-react";
import { DetailSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Forbidden } from "@/components/employer/forbidden";
import { PromotePanel } from "@/components/employer/promote-panel";
import { getEmployerContext } from "@/server/current-user";
import { db } from "@/server/db";
import { distributionLog } from "@/server/services/promote";

// SCR-E10. Needs social.promote; a job that isn't live or a plan without socials shows why.

async function Promote({ params }: { params: Promise<{ id: string }> }) {
  const [ctx, { id }, locale, t] = await Promise.all([
    getEmployerContext(),
    params,
    getLocale(),
    getTranslations("promote"),
  ]);
  if (!ctx) redirect("/");
  if (!ctx.membership) redirect("/employer/onboarding/venue");
  const job = await db.job.findUnique({ where: { id } });
  if (!job || job.venueId !== ctx.membership.venueId) notFound();
  if (!ctx.membership.permissions.has("social.promote")) {
    return <Forbidden venueId={ctx.membership.venueId} />;
  }
  const log = await distributionLog(job);
  const title = (locale === "am" ? job.titleAm || job.titleEn : job.titleEn || job.titleAm) || "—";

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/employer/jobs/${job.id}`}
        className="inline-flex min-h-10 w-fit items-center gap-1.5 text-small text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-small text-text-secondary">{t("title")}</p>
        <h1 className="text-h1 wrap-break-word">{title}</h1>
        <p className="text-text-secondary">{t("intro")}</p>
      </div>
      {!log.eligibility.allowed && log.posts.length === 0 && (
        <section
          data-testid="promote-locked"
          className="flex flex-col items-start gap-2 rounded-md border-2 border-brand-accent bg-card p-4"
        >
          <Lock className="size-5 text-text-secondary" aria-hidden />
          <h2 className="text-h3">{t("lockedTitle")}</h2>
          <p className="text-text-secondary">{t("lockedBody")}</p>
          {ctx.membership.permissions.has("billing.manage") && (
            <Link
              href="/employer/plans"
              className="inline-flex h-11 items-center rounded-sm bg-primary px-4 font-medium text-primary-foreground"
            >
              {t("upgrade")}
            </Link>
          )}
        </section>
      )}
      {!log.live && log.posts.length === 0 && (
        <p className="rounded-md bg-gray-100 px-4 py-3 text-gray-700">{t("notLive")}</p>
      )}
      <PromotePanel jobId={job.id} initial={log} canPromote={log.live && log.eligibility.allowed} />
    </div>
  );
}

export default async function PromotePage({
  params,
}: PageProps<"/[locale]/employer/jobs/[id]/promote">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<DetailSkeleton label={t("loading")} />}>
      <Promote params={params} />
    </Suspense>
  );
}
