import { feedQuery } from "@/lib/zod-schemas";
import { apiHandler } from "@/server/http/handler";
import { parseQuery } from "@/server/http/validate";
import { listFeed } from "@/server/services/feed";

// Public: no session needed (TRD §7.1). Not cacheable: expiry follows the demo clock.
export const GET = apiHandler(async (req) =>
  Response.json(await listFeed(parseQuery(req, feedQuery)), {
    headers: { "Cache-Control": "no-store" },
  }),
);
