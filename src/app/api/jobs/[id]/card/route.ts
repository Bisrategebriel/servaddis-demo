import { cardQuery } from "@/lib/zod-schemas";
import { now } from "@/server/clock";
import { db } from "@/server/db";
import { notFound } from "@/server/http/errors";
import { apiHandler } from "@/server/http/handler";
import { parseQuery } from "@/server/http/validate";
import { authorizeJob } from "@/server/policy/authorize";
import { requireUser } from "@/server/services/auth";
import { renderCard } from "@/server/services/cards";

// GET /api/jobs/:id/card?lang=am|en&size=square|story → PNG (TRD §7.1). Public while the job is
// live (the card is what gets shared); otherwise only for venue members with job.view.
export const GET = apiHandler<{ params: Promise<{ id: string }> }>(async (req, ctx) => {
  const { id } = await ctx.params;
  const { lang, size, download } = parseQuery(req, cardQuery);
  const job = await db.job.findUnique({ where: { id }, include: { venue: true, subCity: true } });
  if (!job) throw notFound();
  const live = job.status === "LIVE" && !!job.expiresAt && job.expiresAt > now();
  if (!live) await authorizeJob(await requireUser(req), id, "job.view");

  const image = await renderCard(job, lang, size);
  return new Response(image.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="servaddis-${job.id}-${lang}-${size}.png"`,
    },
  });
});
