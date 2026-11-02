import { profileBody } from "@/lib/zod-schemas";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { myProfile, updateProfile } from "@/server/services/profile";

export const GET = withAuth({ role: "JOBSEEKER" }, async (_req, { user }) =>
  Response.json(
    { profile: await myProfile(user.id) },
    { headers: { "Cache-Control": "no-store" } },
  ),
);

export const PATCH = withAuth({ role: "JOBSEEKER" }, async (req, { user }) => {
  await updateProfile(user.id, await parseBody(req, profileBody));
  return Response.json({ profile: await myProfile(user.id) });
});
