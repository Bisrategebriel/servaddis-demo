import { NextResponse } from "next/server";
import { LOCALE_COOKIE } from "@/i18n/locales";
import { requireToolkit } from "@/server/demo/access";
import { resetDemo } from "@/server/demo/reset";
import { apiHandler } from "@/server/http/handler";
import { clearedSessionCookie } from "@/server/session";

export const POST = apiHandler(async (req) => {
  requireToolkit(req);
  const started = Date.now();
  const summary = await resetDemo();
  const res = NextResponse.json({ redirectTo: "/", tookMs: Date.now() - started, summary });
  res.cookies.set(clearedSessionCookie(req));
  res.cookies.delete(LOCALE_COOKIE); // the next run starts on the default Amharic landing
  return res;
});
