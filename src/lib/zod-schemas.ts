import { z } from "zod";
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
