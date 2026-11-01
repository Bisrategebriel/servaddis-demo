import { moderationDecisionBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { decide } from "@/server/services/moderation";

export const POST = withAuth({ platform: "admin.moderate" }, async (req, { user, params }) => {
  const { decision, reason } = await parseBody(req, moderationDecisionBody);
  const item = await decide(user, String(params.id), decision, reason);
  return Response.json({ item });
});
