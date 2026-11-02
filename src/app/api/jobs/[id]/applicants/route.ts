import { applicantsQuery } from "@/lib/zod-schemas";
import { parseQuery } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { listApplicants } from "@/server/services/pipeline";

// ?since=<cursor from the last response> returns only applications that changed (TRD §7.2).
export const GET = withAuth({ perm: "applicant.view", resource: "job" }, async (req, { job }) => {
  const { sort, status, since } = parseQuery(req, applicantsQuery);
  return Response.json(
    await listApplicants(job.id, { sort, status, since: since ? new Date(since) : undefined }),
    { headers: { "Cache-Control": "no-store" } },
  );
});
