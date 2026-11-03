import { CircleAlert, CircleX, Info, ShieldAlert, Zap } from "lucide-react";
import { DetailSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DecisionPanel } from "@/components/admin/decision-panel";
import { previewContext } from "@/components/employer/composer/composer-data";
import { JobPreview } from "@/components/employer/composer/job-preview";
import { JobStatusChip } from "@/components/employer/job-status-chip";
import { formFromJob } from "@/lib/job-form";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/current-user";
import { AppError } from "@/server/http/errors";
import type { Flag } from "@/server/rules/engine";
import { getItem } from "@/server/services/moderation";

// SCR-A02 review. The id and session are request data, so everything sits inside <Suspense>.

type Item = Awaited<ReturnType<typeof getItem>>;

const FLAG_STYLE = {
  block: { icon: CircleX, tone: "bg-danger-bg text-danger-fg" },
  warn: { icon: CircleAlert, tone: "bg-warning-bg text-warning-fg" },
  info: { icon: Info, tone: "bg-info-bg text-info-fg" },
} as const;

async function LicenseReview({ item }: { item: Item }) {
  const t = await getTranslations("moderation");
  const license = item.license!;
  const fileUrl = `/api/files/${license.fileKey}`;
  return (
    <>
      <div>
        <h1 className="text-h1">{license.venue.nameEn}</h1>
        <p className="text-small break-all text-text-secondary">{license.fileName}</p>
        {/* Not every browser can show a PDF inside the page. */}
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-10 items-center text-small text-navy-700 underline underline-offset-4"
        >
          {t("openDocument")}
        </a>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {license.mime === "application/pdf" ? (
          <iframe
            src={fileUrl}
            title={license.fileName}
            className="h-[60vh] w-full rounded-2xl border border-border bg-card"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- private, authorized file
          <img
            src={fileUrl}
            alt={license.fileName}
            className="max-h-[60vh] w-full rounded-2xl border border-border bg-card object-contain"
          />
        )}
        <Decision item={item} />
      </div>
    </>
  );
}

async function JobReview({ item }: { item: Item }) {
  const [t, tf, tl, locale] = await Promise.all([
    getTranslations("moderation"),
    getTranslations("jobs.rules.fields"),
    getTranslations("jobs.overview.sources"),
    getLocale(),
  ]);
  const job = item.job!;
  const flags = JSON.parse(item.flags) as Flag[];
  const sensitive = flags.some((f) => f.ruleId === "sensitive-family");
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-h1">{job.titleEn || job.titleAm}</h1>
        <p className="text-small text-text-secondary">
          {job.venue.nameEn} · {job.postingSource ? tl(job.postingSource) : "—"}
        </p>
        <div className="flex flex-wrap gap-2">
          <JobStatusChip status={job.status} />
          {sensitive && (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-warning-bg px-2 py-1 text-caption text-warning-fg">
              <ShieldAlert className="size-3.5" aria-hidden />
              {t("enhancedScrutiny")}
            </span>
          )}
          {item.isFastApprove && (
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-info-bg px-2 py-1 text-caption text-info-fg">
              <Zap className="size-3.5" aria-hidden />
              {t("fastApprove")}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="flags" className="flex flex-col gap-2">
            <h2 id="flags" className="text-h3">
              {t("flagsTitle")}
            </h2>
            {flags.length === 0 ? (
              <p className="text-small text-text-secondary">{t("noFlags")}</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="review-flags">
                {flags.map((f, i) => {
                  const { icon: Icon, tone } = FLAG_STYLE[f.severity];
                  return (
                    <li key={i} className={cn("flex gap-2 rounded-sm px-3 py-2 text-small", tone)}>
                      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>
                        {locale === "am" ? f.messageAm : f.messageEn}{" "}
                        <span className="opacity-80">
                          ({tf(f.field)}
                          {f.match ? `: “${f.match}”` : ""})
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <JobPreview
            form={formFromJob(job, job.subCity.slug, job.roleTemplate?.slug ?? null)}
            {...await previewContext(job.venueId)}
          />
        </div>
        <Decision item={item} />
      </div>
    </>
  );
}

async function Decision({ item }: { item: Item }) {
  const t = await getTranslations("moderation");
  return item.status === "PENDING" ? (
    <DecisionPanel itemId={item.id} allowChanges={item.type === "JOB"} />
  ) : (
    <p role="status" className="text-text-secondary">
      {t("decided")}
    </p>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, t] = await Promise.all([
    params,
    getCurrentUser(),
    getTranslations("moderation"),
  ]);
  if (user?.platformRole !== "ADMIN") redirect("/");
  const item = await getItem(id).catch((err: unknown) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  if (!item.license && !item.job) notFound();

  return (
    <section className="flex flex-col gap-4">
      <Link
        href="/admin/queue"
        className="inline-flex min-h-10 w-fit items-center text-small text-navy-700 underline underline-offset-4"
      >
        {t("back")}
      </Link>
      {item.job ? <JobReview item={item} /> : <LicenseReview item={item} />}
    </section>
  );
}

export default async function ReviewPage({ params }: PageProps<"/[locale]/admin/queue/[id]">) {
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<DetailSkeleton label={t("loading")} />}>
      <Review params={params} />
    </Suspense>
  );
}
