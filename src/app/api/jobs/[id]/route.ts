import { jobDraftBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { updateDraft } from "@/server/services/jobs";

export const GET = withAuth({ perm: "job.view", resource: "job" }, (_req, { job }) =>
  Response.json({ job }),
);

export const PATCH = withAuth({ perm: "job.edit", resource: "job" }, async (req, { job }) =>
  Response.json({ job: await updateDraft(job, await parseBody(req, jobDraftBody)) }),
);
