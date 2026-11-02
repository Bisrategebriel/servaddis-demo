import "server-only";
import type { Job } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { parseRoleTemplateDefaults } from "@/lib/role-template";
import type { EmployerContext } from "@/server/current-user";
import { db } from "@/server/db";
import { vatOf } from "@/server/services/billing";
import { venueEntitlement } from "@/server/services/jobs";
import { ADDIS_SUB_CITIES } from "../../../../prisma/seed/data/geography";
import type { ComposerProps } from "./job-composer";
import type { PreviewLabels } from "./job-preview";

async function labelsFor(locale: "am" | "en"): Promise<PreviewLabels> {
  const t = await getTranslations({ locale, namespace: "jobs.preview" });
  return {
    requirements: t("requirements"),
    benefits: t("benefits"),
    notProvided: t("notProvided"),
    urgent: t("urgent"),
    opening: t("opening"),
    openings: t("openings"),
    phone: t("phone"),
    desktop: t("desktop"),
    languageGroup: t("languageGroup"),
    employment: {
      FULL_TIME: t("employment.FULL_TIME"),
      PART_TIME: t("employment.PART_TIME"),
      CONTRACT: t("employment.CONTRACT"),
      SHIFT: t("employment.SHIFT"),
    },
    period: { MONTH: t("period.MONTH"), DAY: t("period.DAY"), SHIFT: t("period.SHIFT") },
  };
}

/** What the bilingual preview needs besides the form (also used by the job overview). */
export async function previewContext(venueId: string) {
  const [venue, am, en] = await Promise.all([
    db.venue.findUniqueOrThrow({ where: { id: venueId } }),
    labelsFor("am"),
    labelsFor("en"),
  ]);
  return {
    venueEn: venue.nameEn,
    venueAm: venue.nameAm,
    verified: venue.verification === "VERIFIED",
    subCities: [...ADDIS_SUB_CITIES],
    labels: { am, en },
  };
}

/** Everything the composer needs besides the form itself. */
export async function composerContext(
  membership: NonNullable<EmployerContext["membership"]>,
  templateDefaults: string | null,
  job: Pick<Job, "postingSource"> | null,
): Promise<Omit<ComposerProps, "jobId" | "initial">> {
  const [preview, entitlement, urgent] = await Promise.all([
    previewContext(membership.venueId),
    venueEntitlement(db, membership.venueId),
    db.plan.findUnique({ where: { code: "URGENT_POST" } }),
  ]);
  const salaryHint = templateDefaults
    ? parseRoleTemplateDefaults(templateDefaults).salaryHint
    : null;
  return {
    ...preview,
    hint: salaryHint ? { min: salaryHint.min, max: salaryHint.max } : null,
    canSubmit: membership.permissions.has("job.submit"),
    // No posts left: owners can buy a one-time urgent post for this job (App Flow §4.2).
    urgentPost:
      urgent && membership.permissions.has("billing.manage")
        ? { totalEtb: urgent.priceEtb + vatOf(urgent.priceEtb) }
        : null,
    // A resubmit keeps the post it already uses (doc 03 §4.2).
    posting: job?.postingSource
      ? { kind: "RESUBMIT" }
      : entitlement.source === "SUBSCRIPTION"
        ? {
            kind: "SUBSCRIPTION",
            planEn: entitlement.plan!.nameEn,
            planAm: entitlement.plan!.nameAm,
          }
        : entitlement.source === "FOUNDING_FREE"
          ? { kind: "FOUNDING_FREE", left: entitlement.foundingLeft }
          : { kind: "NONE" },
  };
}
