import { withAuth } from "@/server/policy/with-auth";
import { applicationDetail } from "@/server/services/applicant-actions";

export const GET = withAuth(
  { perm: "applicant.view", resource: "application" },
  async (_req, { application, access }) =>
    Response.json(
      {
        application: await applicationDetail(application, access.permissions.has("contact.reveal")),
      },
      { headers: { "Cache-Control": "no-store" } },
    ),
);
