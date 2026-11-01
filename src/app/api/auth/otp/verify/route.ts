import { NextResponse } from "next/server";
import { otpVerifyBody } from "@/lib/zod-schemas";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";
import { RATE_RULES, clientIp, take } from "@/server/rate-limit";
import { publicUser, verifyOtp } from "@/server/services/auth";
import { fromDbLocale, localeCookie } from "@/i18n/locales";
import { isSecureRequest, sessionCookie, signSessionToken } from "@/server/session";

export const POST = apiHandler(async (req) => {
  const wait = take(`otp-verify:ip:${clientIp(req)}`, RATE_RULES.otpVerifyPerIp);
  if (wait) {
    throw new AppError("RATE_LIMITED", {
      details: { reason: "THROTTLED", retryAfterSec: wait },
      headers: { "Retry-After": String(wait) },
    });
  }
  const { phone, code, intent } = await parseBody(req, otpVerifyBody);
  const { user, isNew, redirectTo } = await verifyOtp(phone, code, intent);

  const res = NextResponse.json({ user: publicUser(user), isNew, redirectTo });
  res.cookies.set(
    sessionCookie(req, await signSessionToken({ userId: user.id, role: user.platformRole })),
  );
  // The user's saved language wins after sign-in (TRD §6 resolution order).
  res.cookies.set(localeCookie(fromDbLocale(user.locale), isSecureRequest(req)));
  return res;
});
