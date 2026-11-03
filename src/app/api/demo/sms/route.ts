import { db } from "@/server/db";
import { requireToolkit } from "@/server/demo/access";
import { apiHandler } from "@/server/http/handler";

// Simulated SMS outbox for the toolkit phone drawer (TRD §5.10): what would have been sent, with
// the recipient's name where the number belongs to a user.
export const GET = apiHandler(async (req) => {
  requireToolkit(req);
  const rows = await db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const users = await db.user.findMany({
    where: { phone: { in: [...new Set(rows.map((r) => r.toPhone))] } },
    select: { phone: true, name: true },
  });
  const names = new Map(users.map((u) => [u.phone, u.name]));
  const items = rows.map((r) => ({ ...r, name: names.get(r.toPhone) || null }));
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
});
