import { createHash } from "node:crypto";
import type { Job } from "@prisma/client";

// Editing any of these on a LIVE job re-queues it; they also make up the repost hash (doc 05 §6.1).
const MATERIAL_FIELDS = [
  "titleEn",
  "titleAm",
  "descriptionEn",
  "descriptionAm",
  "salaryMin",
  "salaryMax",
  "salaryPeriod",
  "requirementsEn",
  "requirementsAm",
  "employmentType",
  "subCityId",
  "urgency",
] as const;

/** SHA-256 of the normalised material fields, JSON with sorted keys (doc 05 §6.4). */
export function contentHash(job: Pick<Job, (typeof MATERIAL_FIELDS)[number]>) {
  const normalised = Object.fromEntries(
    [...MATERIAL_FIELDS].sort().map((k) => {
      const v = job[k];
      return [k, typeof v === "string" ? v.trim() : (v ?? "")];
    }),
  );
  return createHash("sha256").update(JSON.stringify(normalised)).digest("hex");
}
