import { venuePatchBody } from "@/lib/zod-schemas";
import { db } from "@/server/db";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { updateVenue } from "@/server/services/venues";

export const GET = withAuth({ perm: "job.view", resource: "venue" }, async (_req, { venueId }) => {
  const venue = await db.venue.findUniqueOrThrow({ where: { id: venueId } });
  return Response.json({ venue });
});

export const PATCH = withAuth(
  { perm: "venue.edit", resource: "venue" },
  async (req, { venueId }) => {
    const venue = await updateVenue(venueId, await parseBody(req, venuePatchBody));
    return Response.json({ venue });
  },
);
