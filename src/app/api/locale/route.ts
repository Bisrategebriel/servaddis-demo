import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALES, localeCookie, toDbLocale } from "@/i18n/locales";
import { db } from "@/server/db";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";
import { SESSION_COOKIE, isSecureRequest, readCookie, verifySessionToken } from "@/server/session";

// Language toggle (X-01): remembers the choice in a cookie for everyone, and on User.locale
// when signed in so it follows the user to other devices (App Flow §12).
export const POST = apiHandler(async (req) => {
  const { locale } = await parseBody(req, z.object({ locale: z.enum(LOCALES) }));
  const claims = await verifySessionToken(readCookie(req, SESSION_COOKIE));
  if (claims) {
    await db.user.updateMany({
      where: { id: claims.userId },
      data: { locale: toDbLocale(locale) },
    });
  }
  const res = NextResponse.json({ locale });
  res.cookies.set(localeCookie(locale, isSecureRequest(req)));
  return res;
});
