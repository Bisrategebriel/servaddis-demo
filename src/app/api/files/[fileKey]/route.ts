import { storage } from "@/server/adapters/storage";
import { db } from "@/server/db";
import { notFound } from "@/server/http/errors";
import { authorizePlatform, authorizeVenue } from "@/server/policy/authorize";
import { withAuth } from "@/server/policy/with-auth";

// Licenses are private: only the venue's owner or a moderator can open one (TRD §7). The stored
// type comes from the sniffed bytes, and nosniff stops a browser from guessing another one.
export const GET = withAuth({}, async (_req, { user, params }) => {
  const key = String(params.fileKey);
  const license = await db.licenseDocument.findFirst({ where: { fileKey: key } });
  if (!license) throw notFound();

  if (user.platformRole === "ADMIN") authorizePlatform(user, "admin.moderate");
  else await authorizeVenue(user, license.venueId, "venue.edit");

  const bytes = await storage.read(key);
  if (!bytes) throw notFound();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": license.mime,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(license.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
