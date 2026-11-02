import { withAuth } from "@/server/policy/with-auth";
import { authorizeOwnVenue } from "@/server/policy/authorize";
import { billingOverview } from "@/server/services/billing";

export const GET = withAuth({ role: "EMPLOYER" }, async (_req, { user }) => {
  const { member } = await authorizeOwnVenue(user, "billing.manage");
  return Response.json(await billingOverview(member.venueId), {
    headers: { "Cache-Control": "no-store" },
  });
});
