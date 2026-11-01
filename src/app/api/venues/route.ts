import { venueCreateBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { createVenue } from "@/server/services/venues";

export const POST = withAuth({ role: "EMPLOYER" }, async (req, { user }) => {
  const venue = await createVenue(user, await parseBody(req, venueCreateBody));
  return Response.json({ venue, redirectTo: "/employer/onboarding/license" }, { status: 201 });
});
