import { NextResponse } from "next/server";
import { fromDbLocale, localeCookie } from "@/i18n/locales";
import { PLATFORM_PERMISSIONS, effectivePermissions, permissionList } from "@/lib/permissions";
import { mePatchBody } from "@/lib/zod-schemas";
import { db } from "@/server/db";
import { apiHandler } from "@/server/http/handler";
import { parseBody } from "@/server/http/validate";
import { publicUser, requireUser } from "@/server/services/auth";
import { isSecureRequest } from "@/server/session";

// TRD §5.2: the UI's source of truth for who is signed in and what they may do.
// The UI uses `permissions` only to hide/disable controls; the API enforces.
export const GET = apiHandler(async (req) => {
  const user = await requireUser(req);
  const [memberships, unreadCount] = await Promise.all([
    db.venueMember.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: {
        venueId: true,
        role: true,
        grant: true,
        revoke: true,
        venue: { select: { nameEn: true, nameAm: true, verification: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return Response.json(
    {
      user: publicUser(user),
      memberships: memberships.map((m) => ({
        venueId: m.venueId,
        venueNameEn: m.venue.nameEn,
        venueNameAm: m.venue.nameAm,
        verification: m.venue.verification,
        role: m.role,
        permissions: permissionList(effectivePermissions(m)),
      })),
      platformPermissions: user.platformRole === "ADMIN" ? [...PLATFORM_PERMISSIONS] : [],
      unreadCount,
      locale: user.locale,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

export const PATCH = apiHandler(async (req) => {
  const user = await requireUser(req);
  const { locale } = await parseBody(req, mePatchBody);
  const updated = await db.user.update({ where: { id: user.id }, data: { locale } });
  const res = NextResponse.json({ user: publicUser(updated) });
  res.cookies.set(localeCookie(fromDbLocale(locale), isSecureRequest(req)));
  return res;
});
