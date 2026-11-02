import { withAuth } from "@/server/policy/with-auth";
import { venueSummary } from "@/server/services/dashboard";

export const GET = withAuth(
  { perm: "job.view", resource: "venue" },
  async (_req, { venueId, access }) =>
    Response.json(await venueSummary(venueId, access.permissions), {
      headers: { "Cache-Control": "no-store" },
    }),
);
