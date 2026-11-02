import { apiHandler } from "@/server/http/handler";
import { feedJob } from "@/server/services/feed";

export const GET = apiHandler<{ params: Promise<{ id: string }> }>(async (_req, ctx) =>
  Response.json(
    { job: await feedJob((await ctx.params).id) },
    {
      headers: { "Cache-Control": "no-store" },
    },
  ),
);
