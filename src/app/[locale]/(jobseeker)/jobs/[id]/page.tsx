import { ArrowLeft, BadgeCheck, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { deadline, pick } from "@/components/jobseeker/job-text";
import { formatDate, formatSalary } from "@/lib/format";
import { now } from "@/server/clock";
import { AppError } from "@/server/http/errors";
import { feedJob } from "@/server/services/feed";

// SCR-J02 job detail: the full post in the viewer's language (with a fallback tag), venue badge,
// and a "no longer open" state. The sticky Apply bar arrives with apply itself (T3.2).

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // "open" and "closes in" follow the demo clock
  const [{ id }, locale, t, tp] = await Promise.all([
    params,
    getLocale(),
    getTranslations("feed"),
    getTranslations("jobs.preview"),
  ]);
  const lang = locale === "am" ? "am" : "en";
  const job = await feedJob(id).catch((err: unknown) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });

  const title = pick(lang, job.titleEn, job.titleAm);
  const description = pick(lang, job.descriptionEn, job.descriptionAm);
  const requirements =
    lang === "am" && job.requirementsAm.length
      ? job.requirementsAm
      : job.requirementsEn.length
        ? job.requirementsEn
        : job.requirementsAm;
  const benefits =
    lang === "am" && job.benefitsAm.length
      ? job.benefitsAm
      : job.benefitsEn.length
        ? job.benefitsEn
        : job.benefitsAm;
  const venue = (lang === "am" ? job.venueAm : null) || job.venueEn;
  const due =
    job.open && job.urgency !== "NORMAL" ? deadline(job.expiresAt, job.urgency, now()) : null;
  const tag = (l: "am" | "en" | null) =>
    l ? (l === "en" ? t("inEnglish") : t("inAmharic")) : null;

  return (
    <article className="flex flex-col gap-5">
      <Link
        href="/jobs"
        className="inline-flex min-h-10 w-fit items-center gap-1.5 text-small text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      {!job.open && (
        <p role="status" className="rounded-md bg-gray-100 px-4 py-3 text-gray-700">
          {t("notOpen")}
        </p>
      )}

      <header className="flex flex-col gap-2">
        {due && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-accent px-2 py-0.5 text-caption font-medium text-navy-900">
            <Zap className="size-3" aria-hidden />
            {t("urgent")} · {t(due.key, due.values)}
          </span>
        )}
        <h1 className="text-h1 wrap-break-word">{title.text}</h1>
        {title.fallback && (
          <span lang={title.fallback} className="-mt-1 text-caption text-text-secondary">
            {tag(title.fallback)}
          </span>
        )}
        <p className="flex items-center gap-1.5 text-text-secondary">
          {venue}
          {job.verified && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-success-bg px-1.5 py-0.5 text-caption text-success-fg">
              <BadgeCheck className="size-3.5" aria-hidden />
              {t("verified")}
            </span>
          )}
        </p>
        <p className="text-h3">
          {formatSalary(job.salaryMin, job.salaryMax)} / {tp(`period.${job.salaryPeriod}`)}
        </p>
        <p className="text-small text-text-secondary">
          {[
            lang === "am" ? job.subCity.nameAm : job.subCity.nameEn,
            tp(`employment.${job.employmentType}`),
            t("openings", { count: job.headcount }),
          ].join(" · ")}
        </p>
      </header>

      <section aria-labelledby="about" className="flex flex-col gap-2 border-t border-border pt-4">
        <h2 id="about" className="text-h3">
          {t("about")}
        </h2>
        {description.fallback && (
          <span lang={description.fallback} className="text-caption text-text-secondary">
            {tag(description.fallback)}
          </span>
        )}
        <p className="whitespace-pre-line">{description.text}</p>
        {job.shiftPattern && (
          <p className="text-small">
            <span className="font-semibold">{t("shift")}:</span> {job.shiftPattern}
          </p>
        )}
      </section>

      {requirements.length > 0 && (
        <section aria-labelledby="req" className="flex flex-col gap-2">
          <h2 id="req" className="text-h3">
            {t("requirements")}
          </h2>
          <ul className="list-disc ps-5">
            {requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}
      {benefits.length > 0 && (
        <section aria-labelledby="ben" className="flex flex-col gap-2">
          <h2 id="ben" className="text-h3">
            {t("benefits")}
          </h2>
          <ul className="list-disc ps-5">
            {benefits.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-small text-text-secondary">
        {t("posted", { date: formatDate(job.publishedAt, locale) })}
        {job.open && ` · ${t("closes", { date: formatDate(job.expiresAt, locale) })}`}
      </p>
    </article>
  );
}

export default function JobDetailPage({ params }: PageProps<"/[locale]/jobs/[id]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-md bg-muted" aria-hidden />}>
      <Detail params={params} />
    </Suspense>
  );
}
