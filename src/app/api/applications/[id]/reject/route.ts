import { rejectBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { rejectApplication } from "@/server/services/applicant-actions";

export const POST = withAuth(
  { perm: "applicant.reject", resource: "application" },
  async (req, { user, application, job }) => {
    const { reason } = await parseBody(req, rejectBody);
    return Response.json({ application: await rejectApplication(user, application, job, reason) });
  },
);
