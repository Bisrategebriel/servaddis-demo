import { withAuth } from "@/server/policy/with-auth";
import { distributionLog } from "@/server/services/promote";

// The publish log, polled every 2 s by the Promote screen until it settles (TRD §7.2).
export const GET = withAuth({ perm: "job.view", resource: "job" }, async (_req, { job }) =>
  Response.json(await distributionLog(job), { headers: { "Cache-Control": "no-store" } }),
);
