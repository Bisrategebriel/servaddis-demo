import { BadgeCheck, Zap } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatSalary } from "@/lib/format";
import type { FeedCard } from "@/server/services/feed";
import { deadline, pick } from "./job-text";

// doc 04 JobCard (feed): text-first, urgent badge with its deadline, salary in bold, sub-city,
// venue with its verified tick. A server component: no client JS per card.

export function JobCard({ job, lang, now }: { job: FeedCard; lang: "am" | "en"; now: Date }) {
  const t = useTranslations("feed");
  const tp = useTranslations("jobs.preview");
  const title = pick(lang, job.titleEn, job.titleAm);
  const venue = (lang === "am" ? job.venueAm : null) || job.venueEn;
  const urgent = job.urgency !== "NORMAL";
  const due = urgent ? deadline(job.expiresAt, job.urgency, now) : null;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-4 hover:border-border-strong"
    >
      {due && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-brand-accent px-2 py-0.5 text-caption font-medium text-navy-900">
          <Zap className="size-3" aria-hidden />
          {t("urgent")} · {t(due.key, due.values)}
        </span>
      )}
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="text-h3 wrap-break-word">{title.text}</span>
        {title.fallback && (
          <span lang={title.fallback} className="text-caption text-text-secondary">
            {title.fallback === "en" ? t("inEnglish") : t("inAmharic")}
          </span>
        )}
      </span>
      <span className="flex items-center gap-1 text-small text-text-secondary">
        {venue}
        {job.verified && (
          <BadgeCheck className="size-4 text-success-fg" aria-label={t("verified")} role="img" />
        )}
      </span>
      <span className="text-small">
        <span className="font-semibold">
          {formatSalary(job.salaryMin, job.salaryMax, lang)} / {tp(`period.${job.salaryPeriod}`)}
        </span>
        <span className="text-text-secondary">
          {" · "}
          {lang === "am" ? job.subCity.nameAm : job.subCity.nameEn} ·{" "}
          {tp(`employment.${job.employmentType}`)}
        </span>
      </span>
    </Link>
  );
}
