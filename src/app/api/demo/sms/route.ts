import { db } from "@/server/db";
import { requireToolkit } from "@/server/demo/access";
import { apiHandler } from "@/server/http/handler";

// Simulated SMS outbox for the demo dock (TRD §5.10): shows what would have been sent.
export const GET = apiHandler(async (req) => {
  requireToolkit(req);
  const items = await db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
});
