import { withAuth } from "@/server/policy/with-auth";
import { viewApplication } from "@/server/services/applicant-actions";

export const POST = withAuth(
  { perm: "applicant.view", resource: "application" },
  async (_req, { user, application, job }) =>
    Response.json({ application: await viewApplication(user, application, job) }),
);
