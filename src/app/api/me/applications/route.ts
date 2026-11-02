import { withAuth } from "@/server/policy/with-auth";
import { etagOf, myApplications } from "@/server/services/applications";

// Polled every 5 s by the tracker. The ETag lets the browser revalidate with If-None-Match and
// get a 304 when nothing changed (TRD §7.2).
export const GET = withAuth({ role: "JOBSEEKER" }, async (req, { user }) => {
  const body = { items: await myApplications(user.id) };
  const etag = etagOf(body);
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (req.headers.get("if-none-match") === etag)
    return new Response(null, { status: 304, headers });
  return Response.json(body, { headers });
});
