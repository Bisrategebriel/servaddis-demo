import { z } from "zod";
import { parseQuery } from "@/server/http/validate";
import { withAuth } from "@/server/policy/with-auth";
import { AUDIT_CATEGORY_KEYS, listAudit } from "@/server/services/audit-log";

// SCR-A03 data (TRD §7): the audit log, newest first, filterable by category, cursor-paged.
const auditQuery = z.object({
  category: z.enum(AUDIT_CATEGORY_KEYS).optional(),
  cursor: z.string().max(40).optional(),
});

export const GET = withAuth({ platform: "admin.audit" }, async (req) => {
  const query = parseQuery(req, auditQuery);
  return Response.json(await listAudit(query), { headers: { "Cache-Control": "no-store" } });
});
