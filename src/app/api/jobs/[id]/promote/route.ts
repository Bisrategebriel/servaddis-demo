import { after } from "next/server";
import { withAuth } from "@/server/policy/with-auth";
import { distributionLog, promoteJob, runDistribution } from "@/server/services/promote";

// 202: the posts exist (QUEUED); rendering and publishing run after the response (TRD §5.6 step 5).
export const POST = withAuth(
  { perm: "social.promote", resource: "job" },
  async (_req, { user, job }) => {
    const { created } = await promoteJob(user, job);
    if (created) after(() => runDistribution(job.id));
    return Response.json(await distributionLog(job), { status: created ? 202 : 200 });
  },
);
