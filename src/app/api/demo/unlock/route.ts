import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { TOOLKIT_COOKIE, requireDemoMode, toolkitToken } from "@/server/demo/access";
import { AppError, forbidden } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";
import { RATE_RULES, clientIp, take } from "@/server/rate-limit";
import { isSecureRequest } from "@/server/session";

export const POST = apiHandler(async (req) => {
  requireDemoMode();
  const wait = take(`demo-unlock:ip:${clientIp(req)}`, RATE_RULES.demoUnlockPerIp);
  if (wait) throw new AppError("RATE_LIMITED", { details: { retryAfterSec: wait } });
  const { passcode } = await parseBody(req, z.object({ passcode: z.string().min(1).max(64) }));
  const expected = process.env.DEMO_TOOLKIT_PASSCODE ?? "";
  const given = Buffer.from(toolkitToken(passcode));
  if (!expected || !timingSafeEqual(given, Buffer.from(toolkitToken(expected)))) throw forbidden();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: TOOLKIT_COOKIE,
    value: toolkitToken(expected),
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
});
