import { z } from "zod";
import { requireToolkit } from "@/server/demo/access";
import { SKIP_DAYS } from "@/lib/demo";
import { timeSkip } from "@/server/demo/actions";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";

// Time-skip (doc 05 §8): advance the demo clock, then sweep (expiry, warnings, check-ins).
export const POST = apiHandler(async (req) => {
  requireToolkit(req);
  const { days } = await parseBody(
    req,
    z.object({ days: z.union(SKIP_DAYS.map((d) => z.literal(d))) }),
  );
  return Response.json(await timeSkip(days));
});
