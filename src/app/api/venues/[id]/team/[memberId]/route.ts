import { memberBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { removeMember, updateMember } from "@/server/services/team";

// Last-owner and self-lockout guards live in the service (App Flow §6.3 step 5).
export const PATCH = withAuth(
  { perm: "team.manage", resource: "venue" },
  async (req, { user, access, venueId, params }) => {
    const input = await parseBody(req, memberBody);
    const member = await updateMember(user, access, venueId, String(params.memberId), input);
    return Response.json({ member });
  },
);

export const DELETE = withAuth(
  { perm: "team.manage", resource: "venue" },
  async (_req, { user, access, venueId, params }) => {
    await removeMember(user, access, venueId, String(params.memberId));
    return new Response(null, { status: 204 });
  },
);
