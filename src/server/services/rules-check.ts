import "server-only";
import type { z } from "zod";
import { parseRoleTemplateDefaults } from "@/lib/role-template";
import type { jobDraftBody } from "@/lib/zod-schemas";
import { db } from "../db";
import { runRules, type Flag, type RuleInput } from "../rules/engine";

// Runs the rules on a draft as submitted by the composer (TRD §5.3 /check) or stored (submit).

type JobDraft = z.output<typeof jobDraftBody>;

export function ruleInputFromDraft(d: JobDraft): RuleInput {
  return {
    titleEn: d.titleEn,
    titleAm: d.titleAm,
    descriptionEn: d.descriptionEn,
    descriptionAm: d.descriptionAm,
    requirementsEn: d.requirementsEn.join("\n"),
    requirementsAm: d.requirementsAm.join("\n"),
    benefitsEn: d.benefitsEn.join("\n"),
    benefitsAm: d.benefitsAm.join("\n"),
    shiftPattern: d.shiftPattern,
    salaryMin: d.salaryMin,
    salaryMax: d.salaryMax,
  };
}

export async function checkDraft(d: JobDraft): Promise<Flag[]> {
  const template = d.roleTemplateSlug
    ? await db.roleTemplate.findUnique({ where: { slug: d.roleTemplateSlug } })
    : null;
  return runRules(
    ruleInputFromDraft(d),
    template
      ? {
          family: template.family,
          salaryHint: parseRoleTemplateDefaults(template.defaults).salaryHint,
        }
      : null,
  );
}
