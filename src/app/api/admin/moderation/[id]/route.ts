import { withAuth } from "@/server/policy/with-auth";
import { getItem } from "@/server/services/moderation";

export const GET = withAuth({ platform: "admin.moderate" }, async (_req, { params }) =>
  Response.json({ item: await getItem(String(params.id)) }),
);
