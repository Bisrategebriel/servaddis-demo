import type { EmploymentType, SalaryPeriod, Urgency } from "@prisma/client";
import type { prefillFromTemplate } from "./role-template";

// Composer form model (E-07, E-08), shared by the UI, the server pages and the tests.
// Numbers stay strings while typing and lists stay one item per line; toJobPayload converts.

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "SHIFT"] as const;
export const SALARY_PERIODS = ["MONTH", "DAY", "SHIFT"] as const;
export const URGENCIES = ["NORMAL", "HALF_DAY", "SAME_DAY", "NEXT_DAY", "TWO_DAYS"] as const;

export type JobForm = {
  roleTemplateSlug: string | null;
  titleEn: string;
  titleAm: string;
  descriptionEn: string;
  descriptionAm: string;
  requirementsEn: string;
  requirementsAm: string;
  benefitsEn: string;
  benefitsAm: string;
  shiftPattern: string;
  subCity: string;
  headcount: string;
  salaryMin: string;
  salaryMax: string;
  salaryPeriod: SalaryPeriod;
  employmentType: EmploymentType;
  urgency: Urgency;
};

export type SalaryHint = { min: number; max: number };

export function emptyJobForm(subCity: string): JobForm {
  return {
    roleTemplateSlug: null,
    titleEn: "",
    titleAm: "",
    descriptionEn: "",
    descriptionAm: "",
    requirementsEn: "",
    requirementsAm: "",
    benefitsEn: "",
    benefitsAm: "",
    shiftPattern: "",
    subCity,
    headcount: "1",
    salaryMin: "",
    salaryMax: "",
    salaryPeriod: "MONTH",
    employmentType: "FULL_TIME",
    urgency: "NORMAL",
  };
}

export function formFromTemplate(
  t: ReturnType<typeof prefillFromTemplate>,
  subCity: string,
): JobForm {
  return {
    ...emptyJobForm(subCity),
    roleTemplateSlug: t.roleTemplateSlug,
    titleEn: t.titleEn,
    titleAm: t.titleAm,
    descriptionEn: t.descriptionEn,
    descriptionAm: t.descriptionAm,
    requirementsEn: t.requirementsEn.join("\n"),
    requirementsAm: t.requirementsAm.join("\n"),
    benefitsEn: t.benefitsEn.join("\n"),
    benefitsAm: t.benefitsAm.join("\n"),
    shiftPattern: t.shiftPattern,
    salaryMin: String(t.salaryMin),
    salaryMax: String(t.salaryMax),
    salaryPeriod: t.salaryPeriod,
    employmentType: t.employmentType,
  };
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export const previewList = lines;

/** The body sent to POST/PATCH /api/jobs. */
export function toJobPayload(f: JobForm) {
  return {
    roleTemplateSlug: f.roleTemplateSlug,
    titleEn: f.titleEn.trim(),
    titleAm: f.titleAm.trim(),
    descriptionEn: f.descriptionEn.trim(),
    descriptionAm: f.descriptionAm.trim(),
    requirementsEn: lines(f.requirementsEn),
    requirementsAm: lines(f.requirementsAm),
    benefitsEn: lines(f.benefitsEn),
    benefitsAm: lines(f.benefitsAm),
    shiftPattern: f.shiftPattern.trim(),
    subCity: f.subCity,
    headcount: Number(f.headcount) || 1,
    salaryMin: Number(f.salaryMin) || 0,
    salaryMax: Number(f.salaryMax) || 0,
    salaryPeriod: f.salaryPeriod,
    employmentType: f.employmentType,
    urgency: f.urgency,
  };
}

export const COMPOSER_STEPS = ["basics", "details", "pay", "preview"] as const;

export type FieldError = "title" | "description" | "subCity" | "salary" | "headcount";

/** Fields that block "Continue". Saving a draft never needs these (E-04: drafts are always ok). */
export function validateStep(f: JobForm, step: number): Partial<Record<FieldError, true>> {
  const errors: Partial<Record<FieldError, true>> = {};
  if (step === 0) {
    if (!f.titleEn.trim() && !f.titleAm.trim()) errors.title = true;
    if (!f.descriptionEn.trim() && !f.descriptionAm.trim()) errors.description = true;
    if (!f.subCity) errors.subCity = true;
  }
  if (step === 2) {
    const min = Number(f.salaryMin);
    const max = Number(f.salaryMax);
    if (!(min > 0) || !(max >= min)) errors.salary = true;
    const headcount = Number(f.headcount);
    if (!Number.isInteger(headcount) || headcount < 1) errors.headcount = true;
  }
  return errors;
}

/** The first step with a blocking problem, or null when the job is complete. */
export function firstInvalidStep(f: JobForm): number | null {
  for (let step = 0; step < COMPOSER_STEPS.length; step++) {
    if (Object.keys(validateStep(f, step)).length > 0) return step;
  }
  return null;
}

/** Non-blocking: far from the template's range (doc 05 §7.1 salary-outlier). */
export function salaryLooksUnusual(f: JobForm, hint: SalaryHint | null): boolean {
  if (!hint) return false;
  const min = Number(f.salaryMin);
  const max = Number(f.salaryMax);
  if (!(min > 0) || !(max > 0)) return false;
  return max > 3 * hint.max || min < 0.3 * hint.min;
}
