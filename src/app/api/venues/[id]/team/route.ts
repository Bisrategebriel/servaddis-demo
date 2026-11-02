import { inviteBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { inviteMember, listTeam } from "@/server/services/team";

export const GET = withAuth(
  { perm: "team.manage", resource: "venue" },
  async (_req, { user, venueId }) =>
    Response.json(
      { members: await listTeam(venueId, user) },
      { headers: { "Cache-Control": "no-store" } },
    ),
);

export const POST = withAuth(
  { perm: "team.manage", resource: "venue" },
  async (req, { user, access, venueId }) => {
    const member = await inviteMember(user, access, venueId, await parseBody(req, inviteBody));
    return Response.json({ member }, { status: 201 });
  },
);
