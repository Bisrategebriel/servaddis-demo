import { withAuth } from "@/server/policy/with-auth";
import { hireApplication } from "@/server/services/applicant-actions";

// { application, jobFilled }: jobFilled is true when this hire reached the headcount.
export const POST = withAuth(
  { perm: "applicant.hire", resource: "application" },
  async (_req, { user, application, job }) =>
    Response.json(await hireApplication(user, application, job)),
);
