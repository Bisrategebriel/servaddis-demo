import { z } from "zod";
import { ADDIS_SUB_CITIES, type SubCitySlug } from "../../prisma/seed/data/geography";
import { normalizePhone } from "./phone";

// Shared client/server schemas (TRD §3: one validation source).

/** Any accepted spelling of an Ethiopian mobile number, normalised to E.164. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const e164 = normalizePhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Ethiopian mobile number" });
      return z.NEVER;
    }
    return e164;
  });

export const otpCodeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export const otpRequestBody = z.object({ phone: phoneSchema });

export const otpVerifyBody = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  intent: z.enum(["EMPLOYER", "JOBSEEKER"]).optional(),
});

export const localeSchema = z.enum(["AM", "EN"]);

export const mePatchBody = z.object({ locale: localeSchema });

export const VENUE_CATEGORIES = [
  "HOTEL",
  "RESTAURANT",
  "CAFE",
  "CATERING",
  "TOUR_OPERATOR",
  "GUESTHOUSE",
  "SPA",
] as const;

const SUB_CITY_SLUGS = ADDIS_SUB_CITIES.map((s) => s.slug) as [SubCitySlug, ...SubCitySlug[]];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

const venueFields = {
  nameEn: z.string().trim().min(2).max(120),
  nameAm: optionalText(120),
  category: z.enum(VENUE_CATEGORIES),
  subCity: z.enum(SUB_CITY_SLUGS),
  contactPhone: phoneSchema,
  descriptionEn: optionalText(500),
  descriptionAm: optionalText(500),
};

export const venueCreateBody = z.object({
  ownerName: z.string().trim().min(2).max(80),
  ...venueFields,
});

export const venuePatchBody = z.object(venueFields).partial();

export const moderationQuery = z.object({
  type: z.enum(["LICENSE", "JOB", "REPORT"]).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CHANGES_REQUESTED"]).default("PENDING"),
});

export const moderationDecisionBody = z
  .object({
    decision: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"]),
    reason: optionalText(500),
  })
  .refine((v) => v.decision === "APPROVE" || !!v.reason, {
    path: ["reason"],
    message: "A reason is required",
  });
