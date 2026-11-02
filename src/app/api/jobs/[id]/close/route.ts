import { withAuth } from "@/server/policy/with-auth";
import { closeJob } from "@/server/services/jobs";

export const POST = withAuth({ perm: "job.close", resource: "job" }, async (_req, { user, job }) =>
  Response.json({ job: await closeJob(user, job) }),
);
