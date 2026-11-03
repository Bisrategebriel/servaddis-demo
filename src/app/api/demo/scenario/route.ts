import { z } from "zod";
import { requireToolkit } from "@/server/demo/access";
import { SCENARIOS } from "@/lib/demo";
import { jumpToScenario } from "@/server/demo/actions";
import { signedInAs } from "@/server/demo/sign-in";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";

// "Skip to state…" (App Flow §9): builds Bruk's story to that point and signs in as Bruk.
export const POST = apiHandler(async (req) => {
  requireToolkit(req);
  const { name } = await parseBody(req, z.object({ name: z.enum(SCENARIOS) }));
  const { user, redirectTo } = await jumpToScenario(name);
  return signedInAs(req, user, { redirectTo });
});
