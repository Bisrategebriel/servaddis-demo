import { applyBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { apply } from "@/server/services/applications";

// Idempotent: 201 for a new application, 200 with the existing one for a repeat tap.
export const POST = withAuth({ role: "JOBSEEKER" }, async (req, { user, params }) => {
  const { note } = await parseBody(req, applyBody);
  const { application, created } = await apply(user, String(params.id), note);
  return Response.json({ application }, { status: created ? 201 : 200 });
});
