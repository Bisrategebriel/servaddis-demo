import { jobDraftBody } from "@/lib/zod-schemas";
import { db } from "@/server/db";
import { notFound } from "@/server/http/errors";
import { parseBody } from "@/server/http/validate";
import { authorizeVenue } from "@/server/policy/authorize";
import { withAuth } from "@/server/policy/with-auth";
import { createDraft } from "@/server/services/jobs";

// The venue comes from the user's membership, never from the request body (doc 05 §5.3).
export const POST = withAuth({ role: "EMPLOYER" }, async (req, { user }) => {
  const member = await db.venueMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!member) throw notFound();
  await authorizeVenue(user, member.venueId, "job.create");
  const job = await createDraft(user, member.venueId, await parseBody(req, jobDraftBody));
  return Response.json({ job }, { status: 201 });
});
