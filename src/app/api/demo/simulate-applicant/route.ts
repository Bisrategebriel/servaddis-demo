import { z } from "zod";
import { requireToolkit } from "@/server/demo/access";
import { simulateApplicant } from "@/server/demo/actions";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";

// Toolkit fallback (TRD §5.10): a seeded jobseeker applies; the employer gets the live toast.
export const POST = apiHandler(async (req) => {
  requireToolkit(req);
  const { jobId } = await parseBody(req, z.object({ jobId: z.string().max(40).optional() }));
  return Response.json(await simulateApplicant(jobId));
});
