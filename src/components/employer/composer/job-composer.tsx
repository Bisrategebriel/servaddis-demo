"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  COMPOSER_STEPS,
  EMPLOYMENT_TYPES,
  SALARY_PERIODS,
  URGENCIES,
  firstInvalidStep,
  salaryLooksUnusual,
  toJobPayload,
  validateStep,
  type FieldError,
  type JobForm,
  type SalaryHint,
} from "@/lib/job-form";
import { cn } from "@/lib/utils";
import type { Flag } from "@/server/rules/engine";
import { BilingualField } from "./bilingual-field";
import { JobPreview, type PreviewLabels } from "./job-preview";
import { RuleFlagList } from "./rule-flag-list";

// SCR-E06: Basics → Details → Pay & urgency → Preview. Rule flags (T2.3) and Submit (T2.4)
// join step 4. Saving a draft is always allowed, whatever is missing (E-04).

const inputClass = "h-11 w-full rounded-sm border border-input bg-card px-3";

export type ComposerProps = {
  jobId: string | null;
  initial: JobForm;
  hint: SalaryHint | null;
  venueEn: string;
  venueAm: string | null;
  verified: boolean;
  subCities: { slug: string; nameEn: string; nameAm: string }[];
  labels: Record<"am" | "en", PreviewLabels>;
};

export function JobComposer(props: ComposerProps) {
  const { initial, hint, venueEn, venueAm, verified, subCities, labels } = props;
  const t = useTranslations("jobs.composer");
  const locale = useLocale();
  const am = locale === "am";
  const [form, setForm] = useState(initial);
  const [jobId, setJobId] = useState(props.jobId);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<FieldError, true>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [checking, setChecking] = useState(false);
  // Where "Fix this" sends the employer: a field group and the language tab to open.
  const [focus, setFocus] = useState<{ field: string; lang: "am" | "en"; n: number } | null>(null);

  // Step 4 runs the same rules as submit, on the unsaved text, shortly after typing stops.
  useEffect(() => {
    if (step !== 3) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch("/api/jobs/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(toJobPayload(form)),
          signal: controller.signal,
        });
        if (res.ok) setFlags((await res.json()).flags);
      } catch {
        // aborted by a newer check, or offline: keep the last result
      }
      setChecking(false);
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [step, form]);

  function fix(flag: Flag) {
    const field = flag.field.replace(/(En|Am)$/, "");
    const target = field === "salary" ? 2 : ["title", "description"].includes(field) ? 0 : 1;
    setFocus((f) => ({
      field,
      lang: flag.field.endsWith("En") ? "en" : "am",
      n: (f?.n ?? 0) + 1,
    }));
    setErrors({});
    setStep(target);
  }
  const focusProps = (field: string) =>
    focus?.field === field
      ? { key: `${field}-${focus.n}`, initialLang: focus.lang, autoFocus: true }
      : { key: field };

  const set = <K extends keyof JobForm>(key: K, value: JobForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
    setErrors({}); // an error shown for the old value must not outlive it
  };
  const setBoth = (en: keyof JobForm, amKey: keyof JobForm) => (lang: "am" | "en", value: string) =>
    set(lang === "am" ? amKey : en, value as never);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

  function goTo(target: number) {
    if (target > step) {
      // Never skip past an invalid step, whichever way the user tries to move forward.
      const blocked = firstInvalidStep(form);
      if (blocked !== null && blocked < target) {
        setStep(blocked);
        setErrors(validateStep(form, blocked));
        return;
      }
    }
    setErrors({});
    setStep(target);
  }

  async function saveDraft() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(jobId ? `/api/jobs/${jobId}` : "/api/jobs", {
        method: jobId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toJobPayload(form)),
      });
      const body = await res.json();
      if (!res.ok) {
        setSaveError(am ? body.error.messageAm : body.error.message);
      } else {
        setSaved(true);
        if (!jobId) {
          setJobId(body.job.id);
          // Point the URL at the draft so a reload keeps it. Not a router navigation: that would
          // remount the composer and lose the current step.
          window.history.replaceState(null, "", `/employer/jobs/${body.job.id}/edit`);
        }
      }
    } catch {
      setSaveError(t("saveFailed"));
    }
    setSaving(false);
  }

  const preview = (
    <JobPreview
      form={form}
      venueEn={venueEn}
      venueAm={venueAm}
      verified={verified}
      subCities={subCities}
      labels={labels}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1">{jobId ? t("editTitle") : t("newTitle")}</h1>

      <ol className="flex flex-wrap gap-x-4 gap-y-2">
        {COMPOSER_STEPS.map((key, i) => (
          <li key={key}>
            <button
              type="button"
              aria-current={i === step ? "step" : undefined}
              onClick={() => goTo(i)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 text-small",
                i === step ? "font-semibold text-foreground" : "text-text-secondary",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-caption",
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-success text-white"
                      : "bg-gray-100 text-gray-700",
                )}
              >
                {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              {t(`steps.${key}`)}
            </button>
          </li>
        ))}
      </ol>

      <div className={cn("grid gap-8", step < 3 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]")}>
        <div className="flex min-w-0 flex-col gap-4">
          {step === 0 && (
            <>
              <BilingualField
                {...focusProps("title")}
                label={t("jobTitle")}
                valueEn={form.titleEn}
                valueAm={form.titleAm}
                onChange={setBoth("titleEn", "titleAm")}
                error={errors.title && t("errors.title")}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="subCity" className="text-small font-medium">
                  {t("subCity")}
                </label>
                <select
                  id="subCity"
                  value={form.subCity}
                  onChange={(e) => set("subCity", e.target.value)}
                  className={inputClass}
                >
                  {subCities.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {am ? s.nameAm : s.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <BilingualField
                {...focusProps("description")}
                label={t("description")}
                multiline
                rows={5}
                valueEn={form.descriptionEn}
                valueAm={form.descriptionAm}
                onChange={setBoth("descriptionEn", "descriptionAm")}
                error={errors.description && t("errors.description")}
              />
            </>
          )}

          {step === 1 && (
            <>
              <BilingualField
                {...focusProps("requirements")}
                label={t("requirements")}
                hint={t("onePerLine")}
                multiline
                rows={5}
                valueEn={form.requirementsEn}
                valueAm={form.requirementsAm}
                onChange={setBoth("requirementsEn", "requirementsAm")}
              />
              <BilingualField
                {...focusProps("benefits")}
                label={t("benefits")}
                hint={t("onePerLine")}
                multiline
                rows={4}
                valueEn={form.benefitsEn}
                valueAm={form.benefitsAm}
                onChange={setBoth("benefitsEn", "benefitsAm")}
              />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="shift" className="text-small font-medium">
                  {t("shiftPattern")}
                </label>
                <input
                  id="shift"
                  maxLength={120}
                  value={form.shiftPattern}
                  onChange={(e) => set("shiftPattern", e.target.value)}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-small font-medium">{t("salary")}</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden>ETB</span>
                  <input
                    aria-label={t("salaryMin")}
                    inputMode="numeric"
                    value={form.salaryMin}
                    aria-invalid={errors.salary}
                    onChange={(e) => set("salaryMin", digits(e.target.value))}
                    className={cn(inputClass, "w-28 aria-invalid:border-danger")}
                  />
                  <span aria-hidden>–</span>
                  <input
                    aria-label={t("salaryMax")}
                    inputMode="numeric"
                    value={form.salaryMax}
                    aria-invalid={errors.salary}
                    onChange={(e) => set("salaryMax", digits(e.target.value))}
                    className={cn(inputClass, "w-28 aria-invalid:border-danger")}
                  />
                  <select
                    aria-label={t("salaryPeriod")}
                    value={form.salaryPeriod}
                    onChange={(e) => set("salaryPeriod", e.target.value as JobForm["salaryPeriod"])}
                    className={cn(inputClass, "w-32")}
                  >
                    {SALARY_PERIODS.map((p) => (
                      <option key={p} value={p}>
                        {labels[am ? "am" : "en"].period[p]}
                      </option>
                    ))}
                  </select>
                </div>
                {hint && (
                  <p className="text-small text-text-secondary">
                    {t("typical", {
                      min: hint.min.toLocaleString("en-US"),
                      max: hint.max.toLocaleString("en-US"),
                    })}
                  </p>
                )}
                {errors.salary && (
                  <p role="alert" className="text-small text-danger-fg">
                    {t("errors.salary")}
                  </p>
                )}
                {salaryLooksUnusual(form, hint) && (
                  <p className="text-small text-warning-fg">{t("salaryUnusual")}</p>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-small font-medium">{t("employment")}</legend>
                <div className="flex flex-wrap gap-x-4">
                  {EMPLOYMENT_TYPES.map((e) => (
                    <label key={e} className="inline-flex min-h-10 items-center gap-2">
                      <input
                        type="radio"
                        name="employment"
                        checked={form.employmentType === e}
                        onChange={() => set("employmentType", e)}
                        className="size-4"
                      />
                      {labels[am ? "am" : "en"].employment[e]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="headcount" className="text-small font-medium">
                  {t("headcount")}
                </label>
                <input
                  id="headcount"
                  inputMode="numeric"
                  value={form.headcount}
                  aria-invalid={errors.headcount}
                  onChange={(e) => set("headcount", digits(e.target.value).slice(0, 3))}
                  className={cn(inputClass, "w-24 aria-invalid:border-danger")}
                />
                {errors.headcount && (
                  <p role="alert" className="text-small text-danger-fg">
                    {t("errors.headcount")}
                  </p>
                )}
              </div>

              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-small font-medium">{t("urgency")}</legend>
                <div className="flex flex-wrap gap-x-4">
                  {URGENCIES.map((u) => (
                    <label key={u} className="inline-flex min-h-10 items-center gap-2">
                      <input
                        type="radio"
                        name="urgency"
                        checked={form.urgency === u}
                        onChange={() => set("urgency", u)}
                        className="size-4"
                      />
                      {t(`urgencies.${u}`)}
                    </label>
                  ))}
                </div>
                <p className="text-small text-text-secondary">{t(`expires.${form.urgency}`)}</p>
              </fieldset>
            </>
          )}

          {step === 3 && (
            <>
              <RuleFlagList flags={flags} loading={checking} onFix={fix} />
              {preview}
            </>
          )}

          {saveError && (
            <p role="alert" className="rounded-sm bg-danger-bg px-3 py-2 text-small text-danger-fg">
              {saveError}
            </p>
          )}
          {saved && (
            <p role="status" className="text-small text-success-fg">
              {t("saved")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            {step > 0 && (
              <Button variant="outline" className="h-11 px-4" onClick={() => goTo(step - 1)}>
                {t("back")}
              </Button>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 px-4" disabled={saving} onClick={saveDraft}>
                {saving ? t("saving") : t("saveDraft")}
              </Button>
              {step < 3 && (
                <Button className="h-11 px-4" onClick={() => goTo(step + 1)}>
                  {t("continue")}
                </Button>
              )}
            </div>
          </div>
        </div>

        {step < 3 && (
          <aside aria-label={t("livePreview")} className="hidden min-w-0 lg:block">
            <h2 className="mb-2 text-h3">{t("livePreview")}</h2>
            {preview}
          </aside>
        )}
      </div>
    </div>
  );
}
