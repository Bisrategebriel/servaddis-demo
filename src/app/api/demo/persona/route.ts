import { NextResponse } from "next/server";
import { z } from "zod";
import { fromDbLocale, localeCookie } from "@/i18n/locales";
import { PERSONA_KEYS } from "@/lib/demo";
import { requireToolkit } from "@/server/demo/access";
import { resolvePersona } from "@/server/demo/persona";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";
import { isSecureRequest, sessionCookie, signSessionToken } from "@/server/session";

// Persona switch: a normal session for a demo user, without the OTP step (TRD §5.1).
export const POST = apiHandler(async (req) => {
  requireToolkit(req);
  const { persona } = await parseBody(req, z.object({ persona: z.enum(PERSONA_KEYS) }));
  const { user, redirectTo } = await resolvePersona(persona);
  const res = NextResponse.json({ redirectTo });
  res.cookies.set(
    sessionCookie(req, await signSessionToken({ userId: user.id, role: user.platformRole })),
  );
  res.cookies.set(localeCookie(fromDbLocale(user.locale), isSecureRequest(req)));
  return res;
});
