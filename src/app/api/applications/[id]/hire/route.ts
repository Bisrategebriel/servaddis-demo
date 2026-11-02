import { withAuth } from "@/server/policy/with-auth";
import { hireApplication } from "@/server/services/applicant-actions";

export const POST = withAuth(
  { perm: "applicant.hire", resource: "application" },
  async (_req, { user, application, job }) =>
    Response.json({ application: await hireApplication(user, application, job) }),
);
