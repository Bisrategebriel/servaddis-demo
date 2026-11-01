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
