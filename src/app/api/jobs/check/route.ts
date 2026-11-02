import { jobDraftBody } from "@/lib/zod-schemas";
import { db } from "@/server/db";
import { notFound } from "@/server/http/errors";
import { parseBody } from "@/server/http/validate";
import { authorizeVenue } from "@/server/policy/authorize";
import { withAuth } from "@/server/policy/with-auth";
import { checkDraft } from "@/server/services/rules-check";
import { hasBlock } from "@/server/rules/engine";

// Rules preview for the composer: the same engine as submit, no side effects (TRD §5.3).
// It takes the unsaved text, so it also works before a draft has an id.
export const POST = withAuth({ role: "EMPLOYER" }, async (req, { user }) => {
  const member = await db.venueMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!member) throw notFound();
  await authorizeVenue(user, member.venueId, "job.create");
  const flags = await checkDraft(await parseBody(req, jobDraftBody));
  return Response.json({ flags, blocked: hasBlock(flags) });
});
