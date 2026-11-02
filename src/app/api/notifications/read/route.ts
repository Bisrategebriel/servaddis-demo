import { notificationsReadBody } from "@/lib/zod-schemas";
import { now } from "@/server/clock";
import { db } from "@/server/db";
import { parseBody } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";

// Marks the given notifications read, or all of them when no ids are sent. Always scoped to the
// signed-in user, so one person can't touch another's notifications by guessing ids.
export const POST = withAuth({}, async (req, { user }) => {
  const { ids } = await parseBody(req, notificationsReadBody);
  const { count } = await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: now() },
  });
  return Response.json({ updated: count });
});
