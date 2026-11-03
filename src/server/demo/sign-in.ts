import "server-only";
import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { fromDbLocale, localeCookie } from "@/i18n/locales";
import { isSecureRequest, sessionCookie, signSessionToken } from "../session";

/** A JSON response that also signs the presenter in as `user` (persona switch, scenario jump). */
export async function signedInAs(req: Request, user: User, body: Record<string, unknown>) {
  const res = NextResponse.json(body);
  res.cookies.set(
    sessionCookie(req, await signSessionToken({ userId: user.id, role: user.platformRole })),
  );
  res.cookies.set(localeCookie(fromDbLocale(user.locale), isSecureRequest(req)));
  return res;
}
