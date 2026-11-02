import { now } from "@/server/clock";
import { db } from "@/server/db";
import { withAuth } from "@/server/policy/with-auth";

// Bell data: the signed-in user's own notifications only, newest first.
export const GET = withAuth({}, async (_req, { user }) => {
  const [items, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return Response.json(
    { items, unreadCount, now: now().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
});
