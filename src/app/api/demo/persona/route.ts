import { z } from "zod";
import { PERSONA_KEYS } from "@/lib/demo";
import { requireToolkit } from "@/server/demo/access";
import { resolvePersona } from "@/server/demo/persona";
import { signedInAs } from "@/server/demo/sign-in";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";

// Persona switch: a normal session for a demo user, without the OTP step (TRD §5.1).
export const POST = apiHandler(async (req) => {
  requireToolkit(req);
  const { persona } = await parseBody(req, z.object({ persona: z.enum(PERSONA_KEYS) }));
  const { user, redirectTo } = await resolvePersona(persona);
  return signedInAs(req, user, { redirectTo });
});
