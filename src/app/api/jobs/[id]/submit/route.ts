import { withAuth } from "@/server/policy/with-auth";
import { submitJob } from "@/server/services/jobs";

export const POST = withAuth({ perm: "job.submit", resource: "job" }, async (_req, { user, job }) =>
  Response.json({ job: await submitJob(user, job) }),
);
