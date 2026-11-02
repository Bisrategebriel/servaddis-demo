import { z } from "zod";
import { ADDIS_SUB_CITIES, type SubCitySlug } from "../../prisma/seed/data/geography";
import { EMPLOYMENT_TYPES, SALARY_PERIODS, URGENCIES } from "./job-form";
import { VENUE_PERMISSIONS } from "./permissions";
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

export const notificationsReadBody = z.object({ ids: z.array(z.string()).max(50).optional() });

const jobText = (max: number) => z.string().trim().max(max);
const jobList = z.array(z.string().trim().min(1).max(300)).max(20);

/** A draft may be incomplete; completeness is checked at submit (T2.4). */
export const jobDraftBody = z.object({
  roleTemplateSlug: z.string().max(60).nullable(),
  titleEn: jobText(120),
  titleAm: jobText(120),
  descriptionEn: jobText(3000),
  descriptionAm: jobText(3000),
  requirementsEn: jobList,
  requirementsAm: jobList,
  benefitsEn: jobList,
  benefitsAm: jobList,
  shiftPattern: jobText(120),
  subCity: z.string().min(1).max(60),
  headcount: z.number().int().min(1).max(999),
  salaryMin: z.number().int().min(0).max(99_999_999),
  salaryMax: z.number().int().min(0).max(99_999_999),
  salaryPeriod: z.enum(SALARY_PERIODS),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  urgency: z.enum(URGENCIES),
});

// Public feed filters (TRD §7.1). The filter sheet is a plain GET form, so empty fields arrive
// as "" and mean "any".
const blank = (v: unknown) => (v === "" ? undefined : v);
export const feedQuery = z.object({
  sub: z.preprocess(blank, z.string().max(40).optional()),
  type: z.preprocess(blank, z.enum(EMPLOYMENT_TYPES).optional()),
  role: z.preprocess(blank, z.string().max(40).optional()),
  min: z.preprocess(blank, z.coerce.number().int().min(0).max(1_000_000).optional()),
  max: z.preprocess(blank, z.coerce.number().int().min(0).max(1_000_000).optional()),
  urgent: z.preprocess(blank, z.enum(["1", "true", "on"]).optional()).transform((v) => !!v),
  q: z.preprocess(blank, z.string().trim().max(60).optional()),
  cursor: z.preprocess(blank, z.coerce.number().int().min(0).optional()),
  limit: z.preprocess(blank, z.coerce.number().int().min(1).max(50).default(20)),
});

export const applyBody = z.object({ note: optionalText(300) });

export const applicantsQuery = z.object({
  sort: z.enum(["completeness", "experience"]).default("completeness"),
  status: z.enum(["APPLIED", "VIEWED", "SHORTLISTED", "HIRED", "REJECTED"]).optional(),
  since: z.iso.datetime().optional(),
});

export const REJECT_REASONS = [
  "NOT_ENOUGH_EXPERIENCE",
  "SKILLS_MISMATCH",
  "LANGUAGE_REQUIREMENT",
  "AVAILABILITY_MISMATCH",
  "POSITION_FILLED",
  "OTHER",
] as const;
export const rejectBody = z.object({ reason: z.enum(REJECT_REASONS) });

/** The basics a jobseeker edits on the read-mostly profile (J-05). */
export const profileBody = z.object({
  name: z.string().trim().min(2).max(80),
  headline: optionalText(120),
  experienceYears: z.coerce.number().int().min(0).max(50),
  availability: optionalText(80),
});

// Team (TRD §7.1): role preset plus per-member overrides, venue permission keys only.
const memberRole = z.enum(["OWNER", "HR_MANAGER", "POSTER", "SCREENER", "VIEWER"]);
const permissionKeys = z.array(z.enum(VENUE_PERMISSIONS)).max(VENUE_PERMISSIONS.length).default([]);
export const memberBody = z.object({
  role: memberRole,
  grant: permissionKeys,
  revoke: permissionKeys,
});
export const inviteBody = memberBody.extend({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
});

export const cardQuery = z.object({
  lang: z.enum(["am", "en"]).default("en"),
  size: z.enum(["square", "story"]).default("square"),
});
