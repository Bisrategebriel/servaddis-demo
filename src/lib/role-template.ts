import type { EmploymentType, SalaryPeriod } from "@prisma/client";

/** Shape of RoleTemplate.defaults (stored as a JSON string, doc 05 §4 / §9.2). */
export type RoleTemplateDefaults = {
  employmentType: EmploymentType;
  shiftPattern: string;
  salaryHint: { min: number; max: number; period: SalaryPeriod };
  descriptionEn: string;
  descriptionAm: string;
  requirementsEn: string[];
  requirementsAm: string[];
  benefitsEn: string[];
  benefitsAm: string[];
  skillSlugs: string[];
};

export type RoleFamily =
  "FRONT_OF_HOUSE" | "KITCHEN" | "HOUSEKEEPING" | "SPA" | "TOURISM" | "MANAGEMENT" | "BAR";

export function parseRoleTemplateDefaults(json: string): RoleTemplateDefaults {
  return JSON.parse(json) as RoleTemplateDefaults;
}

/** A template's content as composer fields, in both languages (E-06). */
export function prefillFromTemplate(t: {
  slug: string;
  nameEn: string;
  nameAm: string;
  defaults: string;
}) {
  const d = parseRoleTemplateDefaults(t.defaults);
  return {
    roleTemplateSlug: t.slug,
    titleEn: t.nameEn,
    titleAm: t.nameAm,
    descriptionEn: d.descriptionEn,
    descriptionAm: d.descriptionAm,
    employmentType: d.employmentType,
    shiftPattern: d.shiftPattern,
    salaryMin: d.salaryHint.min,
    salaryMax: d.salaryHint.max,
    salaryPeriod: d.salaryHint.period,
    requirementsEn: d.requirementsEn,
    requirementsAm: d.requirementsAm,
    benefitsEn: d.benefitsEn,
    benefitsAm: d.benefitsAm,
    skillSlugs: d.skillSlugs,
  };
}
