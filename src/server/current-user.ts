import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { effectivePermissions, type VenuePermission } from "@/lib/permissions";
import { db } from "./db";
import { SESSION_COOKIE, verifySessionToken } from "./session";

// Session reads for Server Components (route handlers use requireUser(req) instead).
// cookies() is request data: with Cache Components every caller must render inside <Suspense>.

export const getCurrentUser = cache(async () => {
  const claims = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await db.user.findUnique({ where: { id: claims.userId } });
  return user && user.platformRole === claims.role ? user : null;
});

export type EmployerContext = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  membership: {
    venueId: string;
    venueNameEn: string;
    venueNameAm: string | null;
    role: string;
    permissions: Set<VenuePermission>;
  } | null;
  unreadCount: number;
};

/** The signed-in employer, their (first) active venue membership and unread count. */
export const getEmployerContext = cache(async (): Promise<EmployerContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const [member, unreadCount] = await Promise.all([
    db.venueMember.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { venue: { select: { nameEn: true, nameAm: true } } },
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return {
    user,
    unreadCount,
    membership: member
      ? {
          venueId: member.venueId,
          venueNameEn: member.venue.nameEn,
          venueNameAm: member.venue.nameAm,
          role: member.role,
          permissions: effectivePermissions(member),
        }
      : null,
  };
});
