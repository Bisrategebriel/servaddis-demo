import { requireToolkit } from "@/server/demo/access";
import { approveAllPending } from "@/server/demo/actions";
import { apiHandler } from "@/server/http/handler";

// Toolkit fallback (TRD §5.10): approves every pending license and job as the moderator.
export const POST = apiHandler(async (req) => {
  requireToolkit(req);
  return Response.json(await approveAllPending());
});
