import "server-only";
import { getTranslations } from "next-intl/server";
import { parseRoleTemplateDefaults } from "@/lib/role-template";
import { db } from "@/server/db";
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

/** Everything the composer needs besides the form itself. */
export async function composerContext(
  venueId: string,
  templateDefaults: string | null,
): Promise<Omit<ComposerProps, "jobId" | "initial">> {
  const [venue, am, en] = await Promise.all([
    db.venue.findUniqueOrThrow({ where: { id: venueId } }),
    labelsFor("am"),
    labelsFor("en"),
  ]);
  const salaryHint = templateDefaults
    ? parseRoleTemplateDefaults(templateDefaults).salaryHint
    : null;
  return {
    hint: salaryHint ? { min: salaryHint.min, max: salaryHint.max } : null,
    venueEn: venue.nameEn,
    venueAm: venue.nameAm,
    verified: venue.verification === "VERIFIED",
    subCities: [...ADDIS_SUB_CITIES],
    labels: { am, en },
  };
}
