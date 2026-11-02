import { z } from "zod";
import { parseQuery } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { venueInsights } from "@/server/services/insights";

const query = z.object({ range: z.enum(["30d", "90d", "180d"]).default("90d") });

// GET /api/venues/:id/insights?range=30d|90d|180d (TRD §7.1), insights.view only.
export const GET = withAuth(
  { perm: "insights.view", resource: "venue" },
  async (req, { venueId }) =>
    Response.json(await venueInsights(venueId, parseQuery(req, query).range), {
      headers: { "Cache-Control": "no-store" },
    }),
);
