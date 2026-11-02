import { withAuth } from "@/server/policy/with-auth";
import { shortlistApplication } from "@/server/services/applicant-actions";

export const POST = withAuth(
  { perm: "applicant.shortlist", resource: "application" },
  async (_req, { user, application, job }) =>
    Response.json({ application: await shortlistApplication(user, application, job) }),
);
