"use client";

import { BadgeCheck, Clock, Monitor, Smartphone } from "lucide-react";
import { useLocale } from "next-intl";
import { useState } from "react";
import { previewList, type JobForm } from "@/lib/job-form";
import { shiftPatternIn } from "@/lib/shift-patterns";
import { cn } from "@/lib/utils";

// E-08 bilingual preview. Its language is independent of the page, so labels for both languages
// are passed in from the server (the client only holds the current language's messages).

export type PreviewLabels = {
  requirements: string;
  benefits: string;
  notProvided: string;
  urgent: string;
  opening: string;
  openings: string;
  phone: string;
  desktop: string;
  languageGroup: string;
  employment: Record<JobForm["employmentType"], string>;
  period: Record<JobForm["salaryPeriod"], string>;
};

type Lang = "am" | "en";

export function JobPreview({
  form,
  venueEn,
  venueAm,
  verified,
  subCities,
  labels,
}: {
  form: JobForm;
  venueEn: string;
  venueAm: string | null;
  verified: boolean;
  subCities: { slug: string; nameEn: string; nameAm: string }[];
  labels: Record<Lang, PreviewLabels>;
}) {
  const pageLocale = useLocale();
  const [lang, setLang] = useState<Lang>(pageLocale === "am" ? "am" : "en");
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const l = labels[lang];
  // Controls follow the page language; only the job card follows the preview language.
  const ui = labels[pageLocale === "am" ? "am" : "en"];
  const am = lang === "am";
  const title = (am ? form.titleAm : form.titleEn).trim();
  const description = (am ? form.descriptionAm : form.descriptionEn).trim();
  const requirements = previewList(am ? form.requirementsAm : form.requirementsEn);
  const benefits = previewList(am ? form.benefitsAm : form.benefitsEn);
  const sub = subCities.find((s) => s.slug === form.subCity);
  const min = Number(form.salaryMin).toLocaleString("en-US");
  const max = Number(form.salaryMax).toLocaleString("en-US");
  const missing = <span className="text-text-secondary">{l.notProvided}</span>;

  const toggle = (
    active: boolean,
    onClick: () => void,
    content: React.ReactNode,
    label?: string,
  ) => (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 min-w-10 items-center justify-center rounded-sm px-2 text-small font-semibold",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
      )}
    >
      {content}
    </button>
  );

  return (
    <div className="flex flex-col gap-3" data-testid="job-preview">
      <div className="flex items-center justify-between gap-2">
        <div role="group" aria-label={ui.languageGroup} className="flex gap-1">
          {toggle(am, () => setLang("am"), <span lang="am">አማ</span>, "አማርኛ")}
          {toggle(!am, () => setLang("en"), <span lang="en">EN</span>, "English")}
        </div>
        <div className="flex gap-1">
          {toggle(
            device === "phone",
            () => setDevice("phone"),
            <Smartphone className="size-4" aria-hidden />,
            ui.phone,
          )}
          {toggle(
            device === "desktop",
            () => setDevice("desktop"),
            <Monitor className="size-4" aria-hidden />,
            ui.desktop,
          )}
        </div>
      </div>

      <article
        lang={lang}
        data-device={device}
        className={cn(
          "mx-auto flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-4",
          device === "phone" ? "max-w-[360px]" : "max-w-full",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-h2 break-words">{title || missing}</h3>
          {form.urgency !== "NORMAL" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-caption text-navy-900">
              <Clock className="size-3" aria-hidden />
              {l.urgent}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-small text-text-secondary">
          {am && venueAm ? venueAm : venueEn}
          {verified && <BadgeCheck className="size-4 text-success-fg" aria-hidden />}
        </p>
        <p className="font-semibold tabular-nums">
          {am ? `${min}–${max} ብር` : `ETB ${min}–${max}`} / {l.period[form.salaryPeriod]}
        </p>
        <p className="text-small text-text-secondary">
          {[
            am ? sub?.nameAm : sub?.nameEn,
            l.employment[form.employmentType],
            shiftPatternIn(lang, form.shiftPattern.trim()),
            (Number(form.headcount || 1) === 1 ? l.opening : l.openings).replace(
              "#",
              form.headcount || "1",
            ),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-small whitespace-pre-line">{description || missing}</p>
        {[
          [l.requirements, requirements],
          [l.benefits, benefits],
        ].map(([heading, items]) => (
          <div key={heading as string}>
            <h4 className="text-h3">{heading as string}</h4>
            {(items as string[]).length ? (
              <ul className="list-disc pl-5 text-small">
                {(items as string[]).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-small">{missing}</p>
            )}
          </div>
        ))}
      </article>
    </div>
  );
}
