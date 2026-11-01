import { moderationQuery } from "@/lib/zod-schemas";
import { parseQuery } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { listQueue } from "@/server/services/moderation";
import { sweep } from "@/server/sweep";

export const GET = withAuth({ platform: "admin.moderate" }, async (req) => {
  await sweep(); // TRD §5.9: the queue always reflects current time
  const { type, status } = parseQuery(req, moderationQuery);
  return Response.json(
    { items: await listQueue(type, status) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
