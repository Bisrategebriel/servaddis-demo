import { otpRequestBody } from "@/lib/zod-schemas";
import { AppError } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";
import { RATE_RULES, clientIp, take } from "@/server/rate-limit";
import { requestOtp } from "@/server/services/auth";

function throttled(retryAfterSec: number) {
  return new AppError("RATE_LIMITED", {
    details: { reason: "THROTTLED", retryAfterSec },
    headers: { "Retry-After": String(retryAfterSec) },
  });
}

export const POST = apiHandler(async (req) => {
  const ipWait = take(`otp-req:ip:${clientIp(req)}`, RATE_RULES.otpRequestPerIp);
  if (ipWait) throw throttled(ipWait);
  const { phone } = await parseBody(req, otpRequestBody);
  const phoneWait = take(`otp-req:phone:${phone}`, RATE_RULES.otpRequestPerPhone);
  if (phoneWait) throw throttled(phoneWait);

  const result = await requestOtp(phone);
  return Response.json({ ...result, demoHint: process.env.DEMO_MODE === "1" });
});
